// Amar Lifestyle — Today page, tasks, timer, Pomodoro
import * as api from "./api.js";
import { h, icon, t, toast, sheet, confirmBox, busy, ring, todayStr, addDays, fmtTime, fmtHM, mins, durLabel, dhakaIso, pad, dhakaNow, fmtDate } from "./ui.js";
import { route, store, catColor, catNames, catDp, rerender, go, occupationPicker, saveOccupation, myRoles } from "./app.js";
import { prayerNow, prayerCount, religionPicker, saveReligion } from "./prayer.js";
import { askSheet } from "./aicoach.js";
import { showTour } from "./tour.js";
import { examsCard } from "./exams.js";
import { quoteFor } from "./quotes.js";
import { mealNow, classesBetween, classCard } from "./timetable.js";

const unlockAt = tk => new Date(new Date(tk.start_at).getTime() + (new Date(tk.end_at) - new Date(tk.start_at)) * Number(store.cfg.unlock_fraction ?? 0.75));
const lateEnd = tk => new Date(new Date(tk.end_at).getTime() + Number(store.cfg.late_window_min ?? 300) * 60000);

function greeting() {
  const hr = dhakaNow().getHours();
  return hr < 5 ? "Good night" : hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
}

route("today", async page => {
  const today = todayStr();
  const first = (store.profile?.name || "").split(" ")[0];
  page.append(h("header.topbar",
    h("div", h("h1", `${greeting()}, ${first}`), h("div.sub", fmtDate(today, { weekday: "long", day: "numeric", month: "long" }))),
    h("div.row", { style: { gap: "8px" } },
      h("button.ai-orb", { onclick: () => askSheet(), "aria-label": "AI — suggestions and ask", title: "AI" }, h("span", "✨"), h("small", "AI")),
      h("button.icon-btn", { onclick: openTimer, "aria-label": t("Start timer"), title: t("Start timer") }, icon("timer")))));

  const body = h("div");
  page.append(body, h("button.fab", { onclick: () => addTask(), "aria-label": t("Add task") }, icon("plus")));

  let tasks, stats, events;
  try {
    [tasks, stats, events] = await Promise.all([
      api.select("tasks", `select=*&day=eq.${today}&order=pinned.desc,start_at`),
      api.rpc("my_stats"),
      api.select("events", "select=*&order=date"),
    ]);
    api.LS.set("al_today", { day: today, tasks, stats, events });
  } catch (e) {
    const c = api.LS.get("al_today");
    if (!c || c.day !== today) throw e;
    ({ tasks, stats, events } = c);
  }
  const queued = new Set(api.pendingMarks().map(m => m.taskId));
  // tasks added while offline (not on the server yet)
  tasks = [...tasks, ...api.pendingTasks().filter(o => o.start && fmtDay(o.start) === today).map(o => ({
    id: o.tmpId, title: o.title, category: o.category, day: today, start_at: o.start, end_at: o.end, pinned: !!o.pinned,
    dp_value: Math.max(1, Math.round(catDp(o.category) * mins(o.start, o.end) / 60)), status: "pending", is_timer: false, dp_awarded: 0, offlineNew: true,
  }))].sort((a, b) => (b.pinned - a.pinned) || a.start_at.localeCompare(b.start_at));
  const localTimer = api.LS.get("al_localtimer");

  // announcement
  const ann = store.announcements?.[0];
  const seen = api.LS.get("al_ann_seen");
  if (ann && seen !== ann.id && Date.now() - new Date(ann.created_at) < 14 * 864e5) {
    const box = h("div.card", { style: { borderColor: "color-mix(in srgb, var(--amber) 50%, transparent)" } },
      h("div.row.between", h("b", "📢 " + ann.title), h("button.icon-btn", { "aria-label": "Close", onclick: () => { api.LS.set("al_ann_seen", ann.id); box.remove(); } }, icon("x"))),
      h("p.small.muted.mb0", ann.body));
    body.append(box);
  }

  // night report
  const sleep = (store.profile?.sleep_time || "23:30").slice(0, 5);
  const now = dhakaNow(); const nowMin = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = sleep.split(":").map(Number); const sleepMin = sh * 60 + sm;
  const realTasks = tasks.filter(x => !x.is_timer);
  const doneN = realTasks.filter(x => ["completed", "late_completed"].includes(x.status) || queued.has(x.id)).length;
  // a task done 50% counts as half
  const doneW = realTasks.reduce((s, x) => s + (["completed", "late_completed"].includes(x.status) ? (x.done_pct || 100) / 100 : queued.has(x.id) ? 1 : 0), 0);
  const pct = realTasks.length ? doneW / realTasks.length : 0;
  if (realTasks.length && (nowMin >= sleepMin - 30 || nowMin < 240)) {
    const pc = await prayerCount(nowMin < 240 ? addDays(today, -1) : today).catch(() => null);
    body.append(h("a.card", { href: "#/day", style: { display: "block", color: "inherit", background: "linear-gradient(135deg, color-mix(in srgb, var(--cyan) 14%, var(--card)), var(--card))" } },
      h("div.row.between", h("h3.mb0", "🌙 Today's report"), h("span.small", { style: { color: "var(--brand)" } }, "Full report & AI review →")),
      h("div.big", `${Math.round(pct * 100)}% tasks done`),
      h("p.muted.mb0", `${doneN} of ${realTasks.length} tasks · ${stats.today.dp >= 0 ? "+" : ""}${stats.today.dp} DP · ${stats.today.coins} coins today. `,
        pct >= 0.8 ? "Great discipline — streak kept! 🔥" : "Tomorrow is a new chance. Mark the rest before 12 AM."),
      pc !== null ? h("p.mb0", { style: { marginTop: "6px" } }, "🕌 আজ নামাজ: ", h("b", `${pc}/5`), " ওয়াক্ত", pc === 5 ? " — মাশাআল্লাহ! 🤲" : "") : null));
  }

  // running timer
  const running = tasks.find(x => x.status === "running") || (localTimer && { ...localTimer, id: "local", status: "running", start_at: localTimer.start, local: true });
  if (running) body.append(runningBar(running));

  // hero
  const lv = stats.level;
  const toNext = lv.next ? `${lv.next_min - stats.month_dp} DP to ${lv.next}` : "Top level this month!";
  // ask once what they do, so categories fit them
  let pickedRoles = [];
  if (!myRoles().length) {
    const card = h("div.card", { style: { borderColor: "color-mix(in srgb, var(--brand) 45%, transparent)" } },
      h("b", "আপনি কী করেন?"), h("p.small.muted", { style: { margin: "4px 0 8px" } }, "এটা বেছে নিলে আপনার কাজের ধরন অনুযায়ী ক্যাটাগরি দেখাবে (পরে Settings → Profile থেকে বদলানো যাবে)।"),
      occupationPicker([], k => pickedRoles = k), (() => { const b = h("button.btn.primary.small", { style: { marginTop: "8px" } }, "Save"); b.onclick = busy(b, async () => { if (!pickedRoles.length) throw new Error("Pick at least one."); await saveOccupation(pickedRoles); toast("Saved ✓", "ok"); rerender(); }); return b; })());
    body.append(card);
  } else if (!store.profile?.religion) {
    body.append(h("div.card", { style: { borderColor: "color-mix(in srgb, var(--brand) 45%, transparent)" } },
      h("b", "আপনার ধর্ম?"), h("p.small.muted", { style: { margin: "4px 0 8px" } }, "মুসলিম হলে নামাজের সময় ও ওয়াক্ত দেখাবে, আর কয় ওয়াক্ত পড়লেন তার হিসাব রাখবে (Settings → Profile থেকে বদলানো যাবে)।"),
      religionPicker(null, async k => { try { await saveReligion(k); toast("Saved ✓", "ok"); rerender(); } catch (e) { toast(e.message, "bad"); } })));
  }

  // compact summary strip (tasks get the space)
  body.append(h("a.hero.mini", { href: "#/day", style: { color: "inherit" }, title: "Today's full report" },
    ring(pct, `${Math.round(pct * 100)}%`, ""),
    h("div.grow", { style: { minWidth: 0 } },
      h("div", h("b.mid", (stats.today.dp >= 0 ? "+" : "") + stats.today.dp, " DP"), h("span.small.muted", ` · ${doneN}/${realTasks.length} tasks`)),
      h("div.small.muted.ell", toNext)),
    h("div.col-end",
      h("a.level-pill", { href: "#/me" }, icon("medal"), lv.name),
      h("span.small.muted", "🔥 ", stats.streak, "d"))));
  // up next — a reason to come back
  const isEmg = x => (x.title || "").startsWith("🚨");
  const emg = realTasks.find(x => isEmg(x) && x.status === "pending" && new Date(x.end_at) > new Date());
  const upNext = emg || realTasks.find(x => x.status === "pending" && new Date(x.start_at) > new Date());
  if (upNext) {
    const m = Math.max(0, Math.round((new Date(upNext.start_at) - new Date()) / 60000));
    const now0 = new Date(), live = emg && new Date(emg.start_at) <= now0;
    body.append(h("div.upnext" + (emg ? ".emg" : ""), { style: { "--c": emg ? "var(--red)" : upNext.color || catColor(upNext.category) } },
      h("i.dot"), h("div.what", h("span", emg ? (live ? "Emergency — now" : "Emergency — next") : "Up next"), h("b", upNext.title)),
      h("time", live ? `until ${fmtTime(upNext.end_at)}` : fmtTime(upNext.start_at), h("em", live ? `${durLabel(Math.max(1, Math.round((new Date(upNext.end_at) - now0) / 60000)))} left` : `in ${m >= 60 ? Math.floor(m / 60) + "h " : ""}${m % 60}m`))));
  }
  // bills due in the next 3 days (not paid yet)
  try {
    const mo = today.slice(0, 8) + "01", dnum = Number(today.slice(8));
    const [bl, bp] = await Promise.all([api.select("bills", "select=id,title,amount,due_day,monthly,start_month&active=eq.true&due_day=not.is.null"), api.select("bill_payments", `select=bill_id&month=eq.${mo}`)]);
    const soon = bl.filter(b => (b.monthly ? b.start_month <= mo : b.start_month === mo) && !bp.some(p => p.bill_id === b.id) && b.due_day - dnum <= 3);
    if (soon.length) body.append(h("a.small", { href: "#/money/overview", style: { display: "block", margin: "-2px 4px 8px", color: "var(--amber)" } },
      "🧾 ", soon.map(b => `${b.title} ${b.due_day < dnum ? "(late)" : b.due_day === dnum ? "today" : "by " + b.due_day}`).join(" · "), " — tap to pay"));
  } catch { /* offline: skip */ }
  // meal reminder (from your meal plan)
  try { const meal = await mealNow(); if (meal) body.append(meal); } catch { /* offline */ }
  // one line that changes every few seconds: today's AI advice + a quote (tap → AI)
  body.append(tipTicker(today));

  // today's events + countdowns
  const evToday = events.filter(e => e.kind !== "countdown" && (e.date === today || (e.yearly && e.date.slice(5) === today.slice(5))));
  const cds = events.filter(e => e.kind === "countdown" && e.date >= today).slice(0, 3);
  if (evToday.length || cds.length) {
    body.append(h("div.row.wrap", { style: { gap: "8px", marginBottom: "14px" } },
      evToday.map(e => h("span.badge.warn", e.kind === "birthday" ? "🎂 " : e.kind === "meeting" ? "🤝 " : "📌 ", e.title, e.time ? " · " + fmtHM(e.time) : "")),
      cds.map(e => { const d = Math.round((new Date(e.date) - new Date(today)) / 864e5); return h("span.badge", "⏳ ", e.title, ": ", d === 0 ? "today" : `${d} day${d > 1 ? "s" : ""}`); })));
  }

  // task list
  // university classes from the timetable sit in the list by time (no DP)
  let classes = [];
  try { classes = await classesBetween(today, today); } catch { /* offline */ }
  try { const ex = await examsCard(); if (ex) body.append(ex); } catch { /* offline */ }
  // notifications off on this phone? ask once in a while (they are the heart of the reminders)
  if (Date.now() - (api.LS.get("al_push_nudge") || 0) > 3 * 864e5) api.pushState().then(st => {
    if (st === "on" || st === "unsupported" && !/iPhone|iPad|Android/.test(navigator.userAgent)) return;
    const on = h("button.btn.small.primary", "Turn on");
    on.onclick = busy(on, async () => { if (st === "unsupported") { location.hash = "#/notifications"; return; } await api.enablePush(); toast("Notifications on ✓", "ok"); await api.pushTest().catch(() => {}); c.remove(); });
    const c = h("div.tg-hint", { style: { marginBottom: "10px", alignItems: "center", borderColor: "color-mix(in srgb, var(--amber) 45%, transparent)", background: "color-mix(in srgb, var(--amber) 8%, var(--card))" } },
      h("span", "🔔"), h("span.grow", st === "unsupported" ? "নোটিফিকেশন পেতে আগে অ্যাপটা Home Screen-এ যোগ করুন (Share → Add to Home Screen)।" : st === "blocked" ? "নোটিফিকেশন বন্ধ করা আছে — ফোনের Settings থেকে এই সাইটের নোটিফিকেশন চালু করুন।" : "নোটিফিকেশন চালু নেই — টাস্ক, পরীক্ষা আর রাতের রিপোর্টের রিমাইন্ডার পাবেন না।"),
      st === "off" ? on : null, h("button.linkbtn.small", { onclick: () => { api.LS.set("al_push_nudge", Date.now()); c.remove(); } }, "✕"));
    body.querySelector(".upnext")?.after(c);
  }).catch(() => {});
  if (!api.LS.get("al_tg_nudge") && navigator.onLine) {
    api.rpc("has_telegram").then(has => { if (has) { api.LS.set("al_tg_nudge", 1); return; }
      const c = h("div.tg-hint", { style: { marginBottom: "10px" } }, h("span", "✈️"), h("span.grow", "পাসওয়ার্ড ভুলে গেলে যেন সহজে ফেরত পান — ", h("a", { href: "#/notifications" }, "Telegram কানেক্ট করুন")), h("button.linkbtn.small", { onclick: () => { api.LS.set("al_tg_nudge", 1); c.remove(); } }, "✕"));
      body.querySelector(".upnext")?.after(c);
    }).catch(() => {});
  }
  try { const pn = await prayerNow(); if (pn) body.append(pn); } catch { /* offline */ }
  body.append(h("div.section-title", h("h2", "Today's tasks"), h("div.row", { style: { gap: "10px", alignItems: "center" } }, h("button.btn.small.emg", { onclick: () => emergencySheet(tasks) }, "🚨 Emergency"), h("a.small", { href: "#/routine" }, "Set routine"))));
  if (!realTasks.length && !running && !classes.length) {
    body.append(h("div.card.empty", icon("today"), h("p", "No tasks today."),
      h("p.small", "Tap ＋ to add one, or set a daily routine so tasks appear by themselves."),
      h("div.row", { style: { justifyContent: "center" } }, h("button.btn.primary", { onclick: () => addTask() }, icon("plus"), t("Add task")), h("a.btn", { href: "#/routine" }, icon("routine"), t("Routine")))));
  } else {
    if (realTasks.length && !api.LS.get("al_tip_seen")) {
      const tip = h("div.card.small", h("b", "Tip: "), "Mark a task near its end. Unmarked tasks lose DP at 12 AM.",
        h("div", h("button.linkbtn", { onclick: () => { api.LS.set("al_tip_seen", 1); tip.remove(); } }, "Got it")));
      body.append(tip);
    }
    const list = tasks.filter(x => x.status !== "running");
    const emgFirst = list.filter(x => (x.title || "").startsWith("🚨") && x.status === "pending");
    const pinned = [...emgFirst, ...list.filter(x => x.pinned && !emgFirst.includes(x))], rest = [...list.filter(x => !x.pinned && !emgFirst.includes(x)), ...classes].sort((a, b) => a.start_at.localeCompare(b.start_at));
    [...pinned, ...rest].forEach(tk => body.append(tk.isClass ? classCard(tk) : taskCard(tk, queued.has(tk.id))));
  }
  body.append(h("p.center.small.faint.mt", "Unplanned work? Use ", h("button.linkbtn", { onclick: openTimer }, "the timer"), " to earn DP."));
  notifyLoop(tasks);
  setTimeout(() => { if (location.hash.startsWith("#/today") && !document.querySelector(".backdrop")) showTour(); }, 700);
}, { tab: "today" });

// ---------- task card
function taskCard(tk, queued) {
  const c = tk.color || catColor(tk.category);
  const nowD = new Date();
  const ul = unlockAt(tk), le = lateEnd(tk);
  const el = h("div.task" + (["completed", "late_completed"].includes(tk.status) || queued ? ".done" : ""), { style: { "--c": c } });
  const status = {
    completed: h("span.badge.ok", "✓ " + (tk.done_pct && tk.done_pct < 100 ? tk.done_pct + "% · " : "") + "+" + tk.dp_awarded + " DP" + (tk.photo_bonus ? " 📷" : "")),
    late_completed: h("span.badge.warn", "✓ Done late" + (tk.done_pct && tk.done_pct < 100 ? " " + tk.done_pct + "%" : "") + " · 0 DP"),
    not_completed: h("span.badge.bad", "✗ Not done · " + tk.dp_awarded + " DP"),
    missed: h("span.badge.bad", "Missed · " + tk.dp_awarded + " DP"),
  }[tk.status];
  const acts = h("div.acts");
  if (queued) acts.append(h("span.badge.warn", "Saved offline — will sync"));
  else if (tk.status === "pending") {
    if (nowD < ul) acts.append(h("div.lockline", icon("lock"), `Buttons open at ${fmtTime(ul.toISOString())}`));
    else {
      const late = nowD > le;
      const bC = h("button.btn.small.primary", icon("check"), t("Completed"));
      const bN = h("button.btn.small", icon("x"), t("Not Completed"));
      bC.onclick = () => pctSheet(tk, late);
      bN.onclick = busy(bN, async () => { if (await confirmBox("Not completed?", `Marking it now costs nothing (0 DP). Leaving it unmarked costs −${tk.dp_value} DP at 12 AM.`, "Yes, not completed")) await mark(tk, "not_completed"); });
      acts.append(bC, bN);
      if (late) acts.append(h("div.lockline", icon("info"), "Late now: marking Completed gives 0 DP, but counts as done."));
      else if (nowD > new Date(tk.end_at)) acts.append(h("div.lockline", icon("info"), `Full DP until ${fmtTime(le.toISOString())} (half coins).`));
    }
  } else if (tk.photo_path) {
    const b = h("button.btn.small.ghost", icon("camera"), "View photo");
    b.onclick = busy(b, async () => { const u = await api.signedUrl(tk.photo_path); sheet(tk.title, h("img", { src: u, alt: "Proof photo", style: { borderRadius: "14px" } })); });
    acts.append(b);
  }
  el.append(h("div.grow",
    h("div.row.between", h("div.t", ["completed", "late_completed"].includes(tk.status) ? h("span.mark.ok", "✓") : ["not_completed", "missed"].includes(tk.status) ? h("span.mark.bad", "✕") : null, tk.pinned ? h("span.pin", "📌 ") : null, tk.title), status || h("span.dp", `${tk.is_timer ? "" : tk.dp_value + " DP"}`)),
    h("div.meta", h("span", `${fmtTime(tk.start_at)} – ${fmtTime(tk.end_at)}`), h("span", "·"), h("span", tk.category), tk.is_timer ? h("span", "· timer") : null),
    acts));
  if (tk.offlineNew) el.querySelector(".meta")?.append(h("span.warn", "· saved offline"));
  if (tk.status === "pending" && !queued && !tk.offlineNew) el.addEventListener("click", e => { if (!e.target.closest("button,input")) editChoice(tk); });
  return el;
}

// how much of the task was done → DP and coins in the same share
function pctSheet(tk, late) {
  const full = late ? 0 : tk.dp_value;
  sheet("কতটুকু শেষ হয়েছে?", [h("p.hint", `“${tk.title}” — যতটুকু করেছেন সেটা বেছে নিন। DP আর কয়েন সেই অনুযায়ী পাবেন।`),
    h("div.grid2", { style: { gap: "8px" } }, [25, 50, 75, 100].map(p => {
      const b = h("button.btn" + (p === 100 ? ".primary" : ""), { style: { flexDirection: "column", padding: "12px 6px", height: "auto" } }, h("b", { style: { fontSize: "20px" } }, p + "%"), h("span.small", late ? "0 DP (late)" : `+${Math.round(full * p / 100)} DP`));
      b.onclick = busy(b, async () => { document.querySelector(".backdrop")?.click(); await mark(tk, "completed", p); });
      return b;
    }))], { actions: close => [h("button.btn", { onclick: () => close(null) }, "Cancel")] });
}
async function mark(tk, result, pctDone = 100) {
  if (tk.offlineNew) { api.queueMark(tk.id, result, pctDone); toast("Saved offline. It will sync when you're online.", "ok"); rerender(); return; }
  try {
    const r = await api.rpc("complete_task_pct", { p_task: tk.id, p_result: result, p_pct: pctDone });
    if (r.status === "completed") toast(r.no_dp_reason === "added_after_start" ? "Done ✓ — no DP (task was added after it started)" : `${pctDone < 100 ? pctDone + "% done · " : "Great! "}+${r.dp} DP · +${r.coins} coins 🎉`, "ok");
    else if (r.status === "late_completed") toast("Marked done (late) — no DP this time.", "");
    else toast(`Noted. ${r.dp} DP`, "");
    if (navigator.vibrate) navigator.vibrate(30);
    rerender();
  } catch (e) {
    if (e.offline) { api.queueMark(tk.id, result, pctDone); toast("Saved offline. It will sync when you're online.", "ok"); rerender(); }
    else throw e;
  }
}

// ---------- add / edit task
export async function addTask(tk = null, preset = {}) {
  const students = await api.select("students", "select=id,name&active=eq.true&order=name").catch(() => []);
  const stu = h("select.input", h("option", { value: "" }, "— none —"), students.map(x => h("option", { value: x.id, selected: tk?.student_id === x.id }, x.name)));
  const stuRow = h("label.f", h("span", "Student (attendance is added when marked Completed)"), stu);
  const today = todayStr();
  const startDef = (() => { const d = dhakaNow(); d.setMinutes(d.getMinutes() + 30 - (d.getMinutes() % 15)); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; })();
  const title = h("input.input", { value: tk?.title || preset.title || "", placeholder: "e.g. Physics chapter 3", maxlength: "80" });
  const cat = h("select.input", catNames().map(n => h("option", { value: n, selected: (tk?.category || preset.category) === n }, `${n} · ${catDp(n)} DP/hour`)));
  const day = h("input.input", { type: "date", value: tk?.day || preset.day || today, min: today });
  const tStart = tk ? fmtLocalHM(tk.start_at) : preset.time || startDef;
  const start = h("input.input", { type: "time", value: tStart });
  let dur = tk ? mins(tk.start_at, tk.end_at) : 60;
  const durInp = h("input.input", { type: "number", min: "5", max: "720", value: dur, inputmode: "numeric", "aria-label": "Minutes" });
  const quick = h("div.seg", [30, 60, 90, 120].map(m => h("button" + (m === dur ? ".on" : ""), { type: "button", onclick: e => { durInp.value = m; quick.querySelectorAll("button").forEach(b => b.classList.toggle("on", b === e.target)); } }, durLabel(m))));
  const pin = h("input", { type: "checkbox", checked: !!tk?.pinned, id: "pinchk" });
  const showStu = () => { stuRow.style.display = cat.value === "Tuition" && students.length ? "" : "none"; };
  cat.addEventListener("change", showStu); showStu();
  stu.onchange = () => { const x = students.find(y => y.id === stu.value); if (x && !title.value.trim()) title.value = x.name; };
  return sheet(tk ? "Edit task" : t("Add task"), [
    h("label.f", h("span", "What will you do?"), title),
    h("div.grid2", h("label.f", h("span", "Category"), cat), stuRow),
    h("div.grid2", h("label.f", h("span", "Day"), day), h("label.f", h("span", "Start time"), start)),
    h("label.f", h("span", "How long? (minutes)"), quick, h("div", { style: { marginTop: "8px" } }, durInp)),
    h("label.check", { for: "pinchk" }, pin, h("span", "📌 Pin as important (shows at the top)")),
    h("p.hint", "Add tasks before they start to earn DP. Repeats every day? Use Routine instead."),
  ], {
    actions: close => {
      const save = h("button.btn.primary", t("Save"));
      save.onclick = busy(save, async () => {
        if (!title.value.trim()) throw new Error("Please write what you will do.");
        const m = Number(durInp.value); if (!(m >= 5 && m <= 720)) throw new Error("Time must be 5 to 720 minutes.");
        const s = dhakaIso(day.value, start.value); const e = new Date(new Date(s).getTime() + m * 60000).toISOString();
        const student = cat.value === "Tuition" ? stu.value || null : null;
        const row = { title: title.value.trim(), category: cat.value, start_at: s, end_at: e, day: day.value, pinned: pin.checked, student_id: student };
        if (tk?.routine_id) await api.insert("routine_skips", { routine_id: tk.routine_id, day: tk.day, user_id: api.userId() }).catch(() => {}); // only this day changes; the routine won't add it again
        if (tk) await api.update("tasks", `id=eq.${tk.id}`, row);
        else {
          const r = await api.offlineSafe({ kind: "task", title: row.title, category: row.category, start: s, end: e, pinned: row.pinned, studentId: student });
          if (r?.queued) { toast("Saved offline — it will sync when you're online ✓", "ok"); close(true); rerender(); return; }
        }
        if (new Date(s) < new Date()) toast("Saved. It already started, so it earns no DP — use the timer next time.", "");
        else toast("Task saved ✓", "ok");
        close(true); rerender();
      });
      const btns = [h("button.btn", { onclick: () => close(null) }, t("Cancel")), save];
      if (tk) {
        const del = h("button.btn.danger", { "aria-label": t("Delete") }, icon("trash"));
        del.onclick = busy(del, async () => { if (await confirmBox("Delete this task?", tk.routine_id ? "Only this day. The weekly routine stays." : "This cannot be undone.", t("Delete"), true)) { if (tk.routine_id) await api.insert("routine_skips", { routine_id: tk.routine_id, day: tk.day, user_id: api.userId() }).catch(() => {}); await api.remove("tasks", `id=eq.${tk.id}`); toast("Deleted"); close(true); rerender(); } });
        btns.unshift(del);
      }
      return btns;
    },
  });
}
function fmtDay(iso) { const d = new Date(new Date(iso).getTime() + (6 * 60 + new Date().getTimezoneOffset()) * 60000); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function fmtLocalHM(iso) { const d = new Date(new Date(iso).getTime() + (6 * 60 + new Date().getTimezoneOffset()) * 60000); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }

// ---------- timer + Pomodoro
let tick = null;
function runningBar(tk) {
  const face = h("b", "00:00");
  const pom = api.LS.get("al_pomo");
  const phase = h("span.small.muted");
  const upd = () => {
    const sec = Math.floor((Date.now() - new Date(tk.start_at)) / 1000);
    face.textContent = `${pad(Math.floor(sec / 3600))}:${pad(Math.floor(sec / 60) % 60)}:${pad(sec % 60)}`;
    if (pom?.id === tk.id) {
      const cyc = sec % (30 * 60), inFocus = cyc < 25 * 60;
      const left = inFocus ? 25 * 60 - cyc : 30 * 60 - cyc;
      phase.textContent = `${inFocus ? "Focus" : "Break"} · ${pad(Math.floor(left / 60))}:${pad(left % 60)} left`;
      const key = Math.floor(sec / 60) % 30;
      if ((key === 25 || key === 0) && sec % 60 === 0 && sec > 0) notify(inFocus ? "Back to focus! 25 minutes." : "Take a 5-minute break ☕");
    }
  };
  clearInterval(tick); tick = setInterval(upd, 1000); upd();
  const stop = h("button.btn.small.primary", icon("stop"), "Stop");
  stop.onclick = busy(stop, async () => {
    let r;
    if (tk.local) {
      const res = await api.offlineSafe({ kind: "timer", title: tk.title, category: tk.category, start: tk.start_at, end: new Date().toISOString() });
      api.LS.del("al_localtimer"); api.LS.del("al_pomo"); clearInterval(tick);
      if (res?.queued) { toast("Timer saved offline — DP will be added when you're online ✓", "ok"); rerender(); return; }
      r = res;
    } else r = await api.rpc("stop_timer", { p_task: tk.id });
    api.LS.del("al_pomo"); clearInterval(tick);
    toast(r.dp ? `${durLabel(r.minutes)} logged · +${r.dp} DP 🎉` : `${durLabel(r.minutes)} — under 5 min, no DP`, r.dp ? "ok" : "");
    rerender();
  });
  return h("div.running-bar", h("span.pulse"), h("div.grow", h("div", h("b", tk.title), " · ", face), phase.textContent || pom ? phase : h("span.small.muted", tk.category)), stop);
}

export function openTimer() {
  const title = h("input.input", { placeholder: "e.g. Self study", maxlength: "80" });
  const cat = h("select.input", catNames().map(n => h("option", { value: n }, `${n} · ${catDp(n)} DP/hour`)));
  let mode = "free";
  const seg = h("div.seg", [["free", "Free timer"], ["pomo", "Pomodoro 25 + 5"]].map(([k, l]) => h("button" + (k === mode ? ".on" : ""), { type: "button", onclick: e => { mode = k; seg.querySelectorAll("button").forEach(b => b.classList.toggle("on", b === e.target)); } }, l)));
  return sheet(t("Start timer"), [
    h("p.hint", "For work that wasn't planned. DP is counted for the time it runs (at least 5 minutes)."),
    h("label.f", h("span", "What are you doing?"), title), h("label.f", h("span", "Category"), cat), h("label.f", h("span", "Mode"), seg),
  ], {
    actions: close => {
      const go_ = h("button.btn.primary", icon("play"), "Start");
      go_.onclick = busy(go_, async () => {
        let id;
        const tt = title.value.trim() || "Focus session";
        try { id = await api.rpc("start_timer", { p_title: tt, p_category: cat.value }); }
        catch (e) {
          if (!e.offline) throw e;
          id = "local"; api.LS.set("al_localtimer", { title: tt, category: cat.value, start: new Date().toISOString() });
          toast("Offline timer started — it will sync later ✓", "ok");
        }
        if (mode === "pomo") api.LS.set("al_pomo", { id });
        askNotify(); close(true); go("#/today"); rerender();
      });
      return [h("button.btn", { onclick: () => close(null) }, t("Cancel")), go_];
    },
  });
}

// ---------- in-app reminders (while the app is open)
function askNotify() { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); }
function notify(msg) {
  toast(msg); // phone notifications come from the server (push), so inside the app just show a toast
}
let nTimer = null;
function notifyLoop(tasks) {
  clearInterval(nTimer);
  const fired = new Set(api.LS.get("al_fired", []));
  const check = () => {
    const now = Date.now();
    for (const tk of tasks) {
      if (tk.status !== "pending") continue;
      const s = new Date(tk.start_at).getTime(), u = unlockAt(tk).getTime();
      const k1 = tk.id + ":start", k2 = tk.id + ":unlock";
      if (now >= s - 15 * 60000 && now < s && !fired.has(k1)) { fired.add(k1); notify(`In 15 min: ${tk.title}`); }
      if (now >= u && now < u + 5 * 60000 && !fired.has(k2)) { fired.add(k2); notify(`You can now mark “${tk.title}” as Completed.`); }
    }
    api.LS.set("al_fired", [...fired].slice(-200));
  };
  check(); nTimer = setInterval(check, 30000);
}

route("welcome", page => {
  page.append(h("div.auth",
    h("div.center", { style: { marginBottom: "18px" } }, h("div", { style: { display: "inline-block" } }, (() => { const s = document.createElement("img"); s.src = "assets/icon-192.png"; s.width = 88; s.alt = ""; s.style.borderRadius = "22px"; return s; })())),
    h("h1.center", { style: { margin: "0 0 6px" } }, "You're in! 🎉"),
    h("p.center.muted", "Three steps to start:"),
    h("div.list",
      h("a.li", { href: "#/routine" }, h("div.ic", icon("routine")), h("div.grow", h("b", "1. Set your routine"), h("div.small.muted", "Tasks that repeat every day or week")), icon("chev", "chev")),
      h("a.li", { href: "#/settings" }, h("div.ic", icon("shield")), h("div.grow", h("b", "2. Set a 4-digit PIN"), h("div.small.muted", "Needed to edit money entries and export reports")), icon("chev", "chev")),
      h("a.li", { href: "#/today" }, h("div.ic", icon("today")), h("div.grow", h("b", "3. Go to Today"), h("div.small.muted", "Mark tasks, earn DP, level up")), icon("chev", "chev"))),
    h("a.btn.primary.block", { href: "#/today" }, "Start")));
});

// ---------- emergency: something urgent comes up — add it now; the task that is running ends where it starts
function emergencySheet(tasks) {
  const d = dhakaNow(); d.setMinutes(d.getMinutes() + 1);
  const title = h("input.input", { placeholder: "e.g. Hospital — Ammu", maxlength: "80" });
  const cat = h("select.input", catNames().map(n => h("option", { value: n, selected: n === "Work / Personal" }, `${n} · ${catDp(n)} DP/hour`)));
  const start = h("input.input", { type: "time", value: `${pad(d.getHours())}:${pad(d.getMinutes())}` });
  const hrs = h("input.input", { type: "number", min: "0", max: "12", value: "1", inputmode: "numeric", "aria-label": "Hours" });
  const mns = h("input.input", { type: "number", min: "0", max: "59", value: "0", inputmode: "numeric", "aria-label": "Minutes" });
  const dur = { get value() { return Math.max(0, Number(hrs.value) || 0) * 60 + Math.max(0, Number(mns.value) || 0); } };
  const quick = h("div.row.wrap", { style: { gap: "6px", marginTop: "6px" } }, [5, 10, 30, 60, 120, 180, 240, 300].map(m => h("button.chip", { type: "button", onclick: () => { hrs.value = Math.floor(m / 60); mns.value = m % 60; preview(); } }, durLabel(m))));
  const note = h("div.small", { style: { marginTop: "6px" } });
  const at = () => new Date(`${todayStr()}T${start.value}:00+06:00`);
  const preview = () => {
    const s = at(), e = new Date(s.getTime() + Number(dur.value) * 60000);
    const cut = tasks.filter(x => x.status === "pending" && !x.is_timer && new Date(x.start_at) < s && new Date(x.end_at) > s);
    const over = tasks.filter(x => x.status === "pending" && !x.is_timer && new Date(x.start_at) >= s && new Date(x.start_at) < e);
    note.replaceChildren(
      ...cut.map(x => h("div", "✂️ ", h("b", x.title), ` ends at ${fmtTime(s.toISOString())} instead of ${fmtTime(x.end_at)}`)),
      ...over.map(x => h("div.warn", "⚠️ ", h("b", x.title), ` (${fmtTime(x.start_at)}) is inside this time — move or remove it later if needed`)),
      ...(!cut.length && !over.length ? [h("span.muted", "No other task is affected.")] : []));
  };
  start.oninput = hrs.oninput = mns.oninput = preview; preview();
  sheet("🚨 Emergency task", [
    h("label.f", h("span", "What"), title),
    h("label.f", h("span", "Starts"), start),
    h("label.f", h("span", "How long"), h("div.grid2", h("div.row", { style: { gap: "6px", alignItems: "center" } }, hrs, h("span.small.muted", "h")), h("div.row", { style: { gap: "6px", alignItems: "center" } }, mns, h("span.small.muted", "min"))), quick),
    h("label.f", h("span", "Category"), cat),
    note,
  ], {
    actions: close => {
      const go2 = h("button.btn.primary", "Add emergency");
      go2.onclick = busy(go2, async () => {
        if (!title.value.trim()) throw new Error("Write what the emergency is.");
        const s = at(); if (s < new Date(Date.now() - 60000)) throw new Error("Pick now or a later time.");
        if (dur.value < 1 || dur.value > 720) throw new Error("Length must be 1 minute to 12 hours.");
        const r = await api.rpc("emergency_task", { p_title: "🚨 " + title.value.trim(), p_category: cat.value, p_start: s.toISOString(), p_end: new Date(s.getTime() + Number(dur.value) * 60000).toISOString() });
        toast(r.cut?.length ? `Emergency added ✓ · ${r.cut.map(c => c.title).join(", ")} now ends at ${fmtTime(s.toISOString())}` : "Emergency added ✓", "ok");
        close(true); rerender();
      });
      return [h("button.btn", { onclick: () => close(null) }, t("Cancel")), go2];
    },
  });
}

// ---------- rotating advice line (changes every 7 s; new advice each day)
let tickTimer = null;
function tipTicker(today) {
  clearInterval(tickTimer);
  const box = h("button.ticker", { type: "button", onclick: () => askSheet(), "aria-label": "Open AI" });
  const items = () => {
    const c = api.LS.get("al_coach") || {};
    const list = [...(c.alerts || []).map(a => ({ ic: "⚠️", t: a.title, d: a.text, warn: true })), ...(c.tips || []).map(x => ({ ic: "💡", t: x.title, d: x.text }))];
    for (let k = 0; k < 2; k++) { const [q, by] = quoteFor(store.profile?.occupation, today, k); list.push({ ic: "❝", t: q, d: by }); }
    return list;
  };
  let i = Number(api.LS.get("al_tick_i", 0)) || 0;
  const show = () => {
    const L = items(); if (!L.length) return;
    const it = L[i % L.length];
    const line = h("span.tk-in", h("span.tk-ic", it.ic), h("span.tk-txt", h("b", it.t), it.d ? h("span", it.d) : null));
    if (it.warn) box.classList.add("warn"); else box.classList.remove("warn");
    const old = box.firstChild;
    if (old) { old.classList.add("tk-out"); setTimeout(() => old.remove(), 260); }
    box.append(line);
    i++; api.LS.set("al_tick_i", i % 1000);
  };
  show();
  tickTimer = setInterval(() => { if (!document.body.contains(box)) return clearInterval(tickTimer); if (!document.hidden) show(); }, 7000);
  // refresh today's advice in the background (once a day it is new)
  // refresh: new advice once a day, and again after the routine / money changed (at most every 20 min)
  const stale = api.LS.get("al_coach_stale") && Date.now() - (api.LS.get("al_coach_at") || 0) > 20 * 60000;
  if (navigator.onLine) api.ai("coach", stale ? { refresh: true } : {}).then(r => { api.LS.set("al_coach", r); if (stale) { api.LS.del("al_coach_stale"); api.LS.set("al_coach_at", Date.now()); } }).catch(() => {});
  return box;
}

// a task from the weekly routine: change only this day, or every week?
export async function editChoice(tk, routines) {
  if (!tk.routine_id) return addTask(tk);
  const r = (routines || await api.select("routines", `select=*&id=eq.${tk.routine_id}`).catch(() => []))
    .find?.(x => x.id === tk.routine_id);
  if (!r) return addTask(tk);
  const opt = (ic, title, sub, fn) => { const b = h("button.li", { style: { textAlign: "left" } }, h("div.ic", ic), h("div.grow", h("b", title), h("div.small.muted", sub))); b.onclick = () => { document.querySelector(".backdrop")?.click(); setTimeout(fn, 230); }; return b; };
  sheet("Edit “" + tk.title + "”", [h("div.list",
    opt("1️⃣", "Only this week", `Change just ${fmtDate(tk.day, { weekday: "long", day: "numeric", month: "short" })}. Other weeks stay the same.`, () => addTask(tk)),
    opt("🔁", "Every week", "Change the routine itself — all coming weeks.", () => import("./more.js").then(m => m.editRoutine(r))))],
    { actions: close => [h("button.btn", { onclick: () => close(null) }, t("Cancel"))] });
}
