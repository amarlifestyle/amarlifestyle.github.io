/* © 2026 Musfiqur Rahman. All rights reserved. Unauthorized copying is prohibited. Proprietary — see LICENSE. */
// Amar Lifestyle — Today page, tasks, timer, Pomodoro
import * as api from "./api.js";
import { h, icon, t, toast, sheet, confirmBox, busy, ring, todayStr, addDays, fmtTime, fmtHM, mins, durLabel, dhakaIso, pad, dhakaNow, fmtDate, chime, swipeAway } from "./ui.js";
import { route, store, catColor, catNames, catDp, rerender, go, occupationPicker, saveOccupation, myRoles } from "./app.js";
import { prayerNow, prayerCount, religionPicker, saveReligion } from "./prayer.js";
import { askSheet } from "./aicoach.js";
import { showTour } from "./tour.js";
import { timePicker, nowHM } from "./timepick.js";
import { installFirst, isStandalone, showInstall } from "./install.js";
import { examRows, examSheet, markExamDone, doneWord } from "./exams.js";
// hidden from Today on every phone (saved on the server); reminders keep going until it's marked done
const hideExam = (id, on) => api.update("exams", `id=eq.${id}`, { hide_home: on });
import { quoteFor } from "./quotes.js";
import { mealNow, classesBetween, classCard, loadClassIds, isClassTask, noClass } from "./timetable.js";

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
    h("div", h("div.sub.greet", greeting() + ","), h("h1", first || "Today"), h("div.sub", fmtDate(today, { weekday: "long", day: "numeric", month: "long" }))),
    null));

  const body = h("div");
  page.append(body, h("button.fab", { onclick: () => addTask(), "aria-label": t("Add task") }, icon("plus")));

  // start every request at once (not one after another) — the page waits only for the slowest one, not the sum
  const pre = f => { try { const p = Promise.resolve(f()); p.catch(() => {}); return p; } catch (e) { const p = Promise.reject(e); p.catch(() => {}); return p; } };
  const mo0 = today.slice(0, 8) + "01";
  const P = {
    bills: pre(() => Promise.all([api.select("bills", "select=id,title,amount,due_day,monthly,start_month&active=eq.true&due_day=not.is.null"), api.select("bill_payments", `select=bill_id&month=eq.${mo0}`)])),
    meal: pre(() => mealNow(true)),
    classes: pre(() => classesBetween(today, today)),
    exams: pre(() => examRows()),
    syl: pre(() => import("./syllabus.js")),
    chs: pre(() => api.select("syl_chapters", "select=id,subject_id,title,done_on,revised&done_on=not.is.null&revised=lt.4")),
    prayer: pre(() => prayerNow()),
    classIds: pre(() => loadClassIds()),
  };
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
  await P.classIds.catch(() => {});
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

  // one compact card on top: progress + DP + level on the left, the AI report on the right
  const pslot = h("span.pslot");
  body.append(h("div.hero.top",
    h("a.hero-l", { href: "#/day", style: { color: "inherit" } }, ring(pct, `${Math.round(pct * 100)}%`, ""),
      h("div", { style: { minWidth: 0 } },
        h("div.hero-dp", h("b", (stats.today.dp >= 0 ? "+" : "") + stats.today.dp), " DP", h("span.muted", ` · ${doneN}/${realTasks.length}`)),
        h("div.hero-meta", h("span.lvl", { "data-l": lv.name }, lv.name), h("span.muted", "🔥", stats.streak, "d"), pslot))),
    h("a.ai-rep", { href: "#/day" }, h("span.ai-rep-ic", "✨"), h("span", "AI report"))));
  // up next — a reason to come back
  const isEmg = x => (x.title || "").startsWith("🚨");
  const emg = realTasks.find(x => isEmg(x) && x.status === "pending" && new Date(x.end_at) > new Date());
  const upNext = emg || realTasks.find(x => x.status === "pending" && new Date(x.start_at) > new Date());
  // everything extra (prayer, exams, bills, events, meal, setup) sits in ONE small box — tasks keep the space
  const stack = h("div.stack");
  body.append(stack);
  const srow = (ic, main, sub, right, href, cls = "") => {
    const inner = [h("span.s-ic", ic), h("div.s-main", h("div.ell", main), sub ? h("div.s-sub.ell", sub) : null), right || null];
    return href ? h("a.srow" + cls, { href }, inner) : h("div.srow" + cls, inner);
  };
  const dismiss = (key, row, val = 1) => { setTimeout(() => { const r = row(); if (r) swipeAway(r, () => api.LS.set(key, val)); }, 0); return h("button.s-x", { type: "button", "aria-label": "Hide", onclick: e => { e.preventDefault(); api.LS.set(key, val); row().remove(); } }, "✕"); };
  // bills due in the next 3 days (not paid yet)
  try {
    const mo = today.slice(0, 8) + "01", dnum = Number(today.slice(8));
    const [bl, bp] = await P.bills;
    const soon = bl.filter(b => (b.monthly ? b.start_month <= mo : b.start_month === mo) && !bp.some(p => p.bill_id === b.id) && b.due_day - dnum <= 3);
    if (soon.length) stack.append(srow("🧾", soon.map(b => b.title).join(", "), soon.map(b => b.due_day < dnum ? "late" : b.due_day === dnum ? "due today" : "due " + b.due_day + "th").join(" · "), h("span.s-tag.warn", "Pay"), "#/money/overview"));
  } catch { /* offline: skip */ }
  // meal reminder (from your meal plan)
  try { const meal = await P.meal; if (meal) stack.append(srow("🍽️", meal.title, meal.when, null, "#/schedule/meal")); } catch { /* offline */ }
  // one line that changes every few seconds: today's AI advice + a quote (tap → AI)
  body.append(tipTicker(today));

  // today's events + countdowns
  const evToday = events.filter(e => e.kind !== "countdown" && (e.date === today || (e.yearly && e.date.slice(5) === today.slice(5))));
  const cds = events.filter(e => e.kind === "countdown" && e.date >= today).slice(0, 3);
  evToday.forEach(e => stack.append(srow(e.kind === "birthday" ? "🎂" : e.kind === "meeting" ? "🤝" : "📌", e.title, e.kind === "birthday" ? "Birthday today" : e.time ? fmtHM(e.time) : "Today", null, "#/calendar")));
  cds.forEach(e => { const d = Math.round((new Date(e.date) - new Date(today)) / 864e5); stack.append(srow("⏳", e.title, null, h("span.s-tag", d === 0 ? "today" : `${d}d`), "#/calendar")); });

  // task list
  // university classes from the timetable sit in the list by time (no DP)
  let classes = [];
  try { classes = await P.classes; } catch { /* offline */ }
  try {
    const oldHidden = api.LS.get("al_hide_ex", []); // move hides made on this phone to the server once
    if (oldHidden.length) { api.LS.set("al_hide_ex", []); await api.update("exams", `id=in.(${oldHidden.join(",")})`, { hide_home: true }).catch(() => {}); }
    (await P.exams).forEach(x => {
      const ok = h("button.btn.small", { type: "button", title: doneWord(x.e.kind) }, "✓");
      ok.onclick = busy(ok, async ev => { ev?.stopPropagation?.(); await markExamDone(x.e, true); });
      const hideX = h("button.s-x", { type: "button", "aria-label": "Hide from Today" }, "✕");
      const r = srow(x.ic, x.title, x.sub, [h("span.s-tag", { style: { color: x.color } }, x.left), ok, hideX], null);
      hideX.onclick = busy(hideX, async ev => { ev?.stopPropagation?.(); r.dataset.swiped = 1; await hideExam(x.e.id, true); r.remove();
        import("./undo.js").then(U => U.record(`“${x.title}” hidden from Today`, async () => hideExam(x.e.id, false), async () => hideExam(x.e.id, true))); });
      r.style.cursor = "pointer"; r.onclick = ev => { if (!ok.contains(ev.target) && !r.dataset.swiped) examSheet(x.e); };
      swipeAway(r, async () => { await hideExam(x.e.id, true); import("./undo.js").then(U => U.record(`“${x.title}” hidden`, async () => hideExam(x.e.id, false), async () => hideExam(x.e.id, true))); });
      stack.append(r);
    });
  } catch { /* offline */ }
  // chapters due for revision (day 1 / 7 / 15 / 30 after finishing)
  try {
    const { revNext, revDay, markRevised } = await P.syl;
    const chs = await P.chs;
    const due = chs.filter(c => { const n = revNext(c); return n && n <= today; });
    if (due.length) {
      const subs = await api.select("syl_subjects", "select=id,name").catch(() => []);
      const hidden = new Set(api.LS.get("al_rev_hide_" + today, []));
      due.filter(c => !hidden.has(c.id)).slice(0, 4).forEach(c => {
        const ok = h("button.btn.small", { type: "button", title: "Revised" }, "✓");
        const x = h("button.s-x", { type: "button", "aria-label": "Not today" }, "✕");
        const r = srow("📚", `Revise: ${c.title}`, `${subs.find(s => s.id === c.subject_id)?.name || ""} · Day ${revDay(c)}${revNext(c) < today ? " · late" : ""}`, [ok, x], null);
        ok.onclick = busy(ok, async ev => { ev?.stopPropagation?.(); await markRevised(c); toast("Revised ✓", "ok"); r.remove(); });
        const hideToday = () => { const l = new Set(api.LS.get("al_rev_hide_" + today, [])); l.add(c.id); api.LS.set("al_rev_hide_" + today, [...l]); r.remove();
          import("./undo.js").then(U => U.record("Revision hidden for today", async () => { const m = new Set(api.LS.get("al_rev_hide_" + today, [])); m.delete(c.id); api.LS.set("al_rev_hide_" + today, [...m]); }, async () => {})); };
        x.onclick = ev => { ev.stopPropagation(); hideToday(); };
        r.style.cursor = "pointer"; r.onclick = ev => { if (!ok.contains(ev.target) && !x.contains(ev.target)) location.hash = "#/syllabus"; };
        swipeAway(r, hideToday);
        stack.append(r);
      });
    }
  } catch { /* offline */ }
  try { const pn = await P.prayer; if (pn) (pn.classList.contains("pchip") ? pslot.append(pn) : stack.prepend(pn)); } catch { /* offline */ }
  if (!isStandalone() && Date.now() - (api.LS.get("al_inst_strip") || 0) > 864e5) {
    const r = srow("📱", "Add to Home Screen", "for reliable reminders", [h("button.btn.small.primary", { onclick: () => showInstall() }, "Add"), dismiss("al_inst_strip", () => r, Date.now())], null, ".setup");
    stack.append(r);
  }
  // notifications off on this phone? ask once in a while (they are the heart of the reminders)
  if (Date.now() - (api.LS.get("al_push_nudge") || 0) > 3 * 864e5) api.pushState().then(st => {
    if (st === "on" || st === "unsupported" && (!isStandalone() || !/iPhone|iPad|Android/.test(navigator.userAgent))) return; // the Home Screen row covers it
    const on = h("button.btn.small.primary", "Turn on");
    on.onclick = busy(on, async () => { if (st === "unsupported") { location.hash = "#/notifications"; return; } await api.enablePush(); toast("Notifications on ✓", "ok"); await api.pushTest().catch(() => {}); c.remove(); });
    const c = srow("🔔", st === "blocked" ? "Notifications blocked" : st === "unsupported" ? "Add to Home Screen for alerts" : "Notifications off", st === "blocked" ? "Allow them in phone Settings" : "you'll miss reminders",
      [st === "off" ? on : null, dismiss("al_push_nudge", () => c, Date.now())], null, ".setup");
    stack.append(c);
  }).catch(() => {});
  if (!api.LS.get("al_tg_nudge") && navigator.onLine) {
    api.rpc("has_telegram").then(has => { if (has) { api.LS.set("al_tg_nudge", 1); return; }
      const c = srow("✈️", "Connect Telegram", "password reset + loud reminders", [h("span.s-tag", "Connect"), dismiss("al_tg_nudge", () => c)], "#/notifications", ".setup");
      stack.append(c);
    }).catch(() => {});
  }
  body.append(h("div.section-title", h("h2", "Today's tasks"), h("div.row", { style: { gap: "10px", alignItems: "center" } }, h("button.btn.small", { onclick: openTimer, "aria-label": t("Start timer") }, icon("timer"), "Timer"), h("button.btn.small.emg", { onclick: () => emergencySheet(tasks) }, "🚨 Emergency"))));
  if (!realTasks.length && !running && !classes.length) {
    body.append(h("div.card.empty", icon("today"), h("p", "No tasks today."),
      h("p.small", "Tap ＋ to add one, or set a daily routine so tasks appear by themselves."),
      h("div.row", { style: { justifyContent: "center" } }, h("button.btn.primary", { onclick: () => addTask() }, icon("plus"), t("Add task")), h("a.btn", { href: "#/routine" }, icon("routine"), t("Routine")))));
  } else {
    const list = tasks.filter(x => x.status !== "running");
    const emgFirst = list.filter(x => (x.title || "").startsWith("🚨") && x.status === "pending");
    const pinned = [...emgFirst, ...list.filter(x => x.pinned && !emgFirst.includes(x))], rest = [...list.filter(x => !x.pinned && !emgFirst.includes(x)), ...classes].sort((a, b) => a.start_at.localeCompare(b.start_at));
    const isDone = x => !x.isClass && (x.status !== "pending" || queued.has(x.id));
    const all = [...pinned, ...rest], open = all.filter(x => !isDone(x)), finished = all.filter(isDone).sort((a, b) => a.start_at.localeCompare(b.start_at));
    open.forEach((tk, n) => body.append(tk.isClass ? classCard(tk) : taskCard(tk, false, n === 0)));
    if (finished.length) {
      if (open.length) body.append(h("div.done-sep", h("span", `Done · ${finished.length}`)));
      finished.forEach(tk => body.append(taskCard(tk, queued.has(tk.id))));
    }
  }
  notifyLoop(tasks);
  // first: put the app on the home screen, then the guide
  setTimeout(async () => { if (!location.hash.startsWith("#/today") || document.querySelector(".backdrop")) return; await installFirst(); if (location.hash.startsWith("#/today") && !document.querySelector(".backdrop")) showTour(); }, 700);
}, { tab: "today" });

// ---------- task card
function taskCard(tk, queued, first = false) {
  const c = tk.color || catColor(tk.category);
  const nowD = new Date();
  const ul = unlockAt(tk), le = lateEnd(tk);
  const el = h("div.task" + (["completed", "late_completed"].includes(tk.status) || queued ? ".done" : ["not_completed", "missed"].includes(tk.status) ? ".done.bad" : ""), { style: { "--c": c } });
  const status = {
    completed: h("span.badge.ok", "✓ " + (tk.done_pct && tk.done_pct < 100 ? tk.done_pct + "% · " : "") + "+" + tk.dp_awarded + " DP" + (tk.photo_bonus ? " 📷" : "")),
    late_completed: h("span.badge.warn", "✓ Done late" + (tk.done_pct && tk.done_pct < 100 ? " " + tk.done_pct + "%" : "") + " · 0 DP"),
    not_completed: h("span.badge.bad", "✗ Not done · " + tk.dp_awarded + " DP"),
    missed: h("span.badge.bad", "Missed · " + tk.dp_awarded + " DP"),
  }[tk.status];
  const acts = h("div.acts");
  const cls = isClassTask(tk);
  // university class: ✕ = no class today (holiday / cancelled) — not absent, no DP change
  const noCls = cls && tk.status === "pending" && !queued && tk.day === todayStr() ? (() => { const b = h("button.btn.small.nocls", { type: "button", title: "No class today" }, "✕ No class"); b.onclick = busy(b, async ev => { ev?.stopPropagation?.(); await noClass(tk, rerender); }); return b; })() : null;
  if (queued) acts.append(h("span.badge.warn", "Saved offline — will sync"));
  else if (tk.status === "pending") {
    if (nowD < ul) acts.append(h("div.lockline", icon("lock"), `Buttons open at ${fmtTime(ul.toISOString())}`), noCls || "");
    else {
      const late = nowD > le;
      const bC = h("button.btn.small.primary", icon("check"), t("Completed"));
      const bN = h("button.btn.small", icon("x"), t("Not Completed"));
      bC.onclick = () => pctSheet(tk, late);
      bN.onclick = busy(bN, async () => { if (await confirmBox("Not completed?", `Marking it now costs nothing (0 DP). Leaving it unmarked costs −${tk.dp_value} DP at 12 AM.`, "Yes, not completed")) await mark(tk, "not_completed"); });
      acts.append(bC, bN, noCls || "");
      if (late) acts.append(h("div.lockline", icon("info"), "Late now: marking Completed gives 0 DP, but counts as done."));
      else if (nowD > new Date(tk.end_at)) acts.append(h("div.lockline", icon("info"), `Full DP until ${fmtTime(le.toISOString())}.`));
    }
  } else if (["completed", "late_completed", "not_completed"].includes(tk.status) && tk.day === todayStr()) {
    // changed your mind? take the mark back (same day only)
    const u = h("button.linkbtn.small", { type: "button" }, "↺ Undo mark");
    u.onclick = busy(u, async () => { if (!(await confirmBox("Undo this mark?", "The task opens again and its DP is reversed.", "Undo"))) return; await api.rpc("unmark_task", { p_task: tk.id }); toast("Mark removed", "ok"); rerender(); });
    acts.append(u);
  }
  if (tk.status !== "pending" && tk.photo_path) {
    const b = h("button.btn.small.ghost", icon("camera"), "View photo");
    b.onclick = busy(b, async () => { const u = await api.signedUrl(tk.photo_path); sheet(tk.title, h("img", { src: u, alt: "Proof photo", style: { borderRadius: "14px" } })); });
    acts.append(b);
  }
  el.append(h("div.grow",
    h("div.row.between", h("div.t", ["completed", "late_completed"].includes(tk.status) ? h("span.mark.ok", "✓") : ["not_completed", "missed"].includes(tk.status) ? h("span.mark.bad", "✕") : null, tk.pinned ? h("span.pin", "📌 ") : null, tk.title), status || h("span.dp", `${tk.is_timer ? "" : tk.dp_value + " DP"}`)),
    h("div.meta", h("span", `${fmtTime(tk.start_at)} – ${fmtTime(tk.end_at)}`), h("span", "·"), h("span", cls ? "🎓 Class" : tk.category), tk.is_timer ? h("span", "· timer") : null),
    acts));
  if (tk.offlineNew) el.querySelector(".meta")?.append(h("span.warn", "· saved offline"));
  // the first open task counts down: "starts in 25m" → "40m left"
  if (first && tk.status === "pending") {
    const cd = h("div.countdown");
    const tickCd = () => {
      if (!cd.isConnected && cd.dataset.on) return clearInterval(cdT);
      const now = Date.now(), s0 = new Date(tk.start_at).getTime(), e0 = new Date(tk.end_at).getTime();
      const fmt = ms => { const m = Math.max(1, Math.round(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; };
      const soon = now < s0 && s0 - now <= 15 * 60000, low = now >= s0 && now < e0 && e0 - now <= 10 * 60000;
      cd.className = "countdown " + (now < s0 ? (soon ? "cd-soon" : "cd-wait") : now < e0 ? (low ? "cd-low" : "cd-live") : "cd-late");
      cd.replaceChildren(now < s0 ? h("span.cd-pill", icon("clock"), "Starts in ", h("b", fmt(s0 - now))) : now < e0 ? h("span.cd-pill", h("i"), h("b", fmt(e0 - now)), " left") : h("span.cd-pill", icon("warn"), "Time's up — mark it"));
      cd.dataset.on = 1;
    };
    const cdT = setInterval(tickCd, 30000); tickCd();
    el.querySelector(".grow")?.prepend(cd);
    el.classList.add("first");
  }
  if (tk.status === "pending" && !queued && !tk.offlineNew) el.addEventListener("click", e => { if (!e.target.closest("button,input")) editChoice(tk); });
  return el;
}

// how much of the task was done → DP and coins in the same share
function pctSheet(tk, late) {
  const full = late ? 0 : tk.dp_value;
  sheet("How much did you finish?", [h("p.hint", `“${tk.title}”`),
    h("div.grid2", { style: { gap: "8px" } }, [25, 50, 75, 100].map(p => {
      const b = h("button.btn" + (p === 100 ? ".primary" : ""), { style: { flexDirection: "column", padding: "12px 6px", height: "auto" } }, h("b", { style: { fontSize: "20px" } }, p + "%"), h("span.small", late ? "0 DP (late)" : `+${Math.round(full * p / 100)} DP`));
      b.onclick = busy(b, async () => { [...document.querySelectorAll(".backdrop")].pop()?.click(); await mark(tk, "completed", p); });
      return b;
    }))], { actions: close => [h("button.btn", { onclick: () => close(null) }, "Cancel")] });
}
async function mark(tk, result, pctDone = 100) {
  if (tk.offlineNew) { api.queueMark(tk.id, result, pctDone); toast("Saved offline. It will sync when you're online.", "ok"); rerender(); return; }
  try {
    const r = await api.rpc("complete_task_pct", { p_task: tk.id, p_result: result, p_pct: pctDone });
    if (r.status === "completed") toast(r.no_dp_reason === "added_after_start" ? "Done ✓ — no DP (task was added after it started)" : `${pctDone < 100 ? pctDone + "% done · " : "Great! "}+${r.dp} DP 🎉`, "ok");
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
  const tStart = tk ? fmtLocalHM(tk.start_at) : preset.time || nowHM();
  const tp = timePicker({ start: tStart, minutes: tk ? mins(tk.start_at, tk.end_at) : 60 });
  const pin = h("input", { type: "checkbox", checked: !!tk?.pinned, id: "pinchk" });
  const showStu = () => { stuRow.style.display = cat.value === "Tuition" && students.length ? "" : "none"; };
  cat.addEventListener("change", showStu); showStu();
  stu.onchange = () => { const x = students.find(y => y.id === stu.value); if (x && !title.value.trim()) title.value = x.name; };
  return sheet(tk ? "Edit task" : t("Add task"), [
    h("label.f", h("span", "What will you do?"), title),
    h("div.grid2", h("label.f", h("span", "Category"), cat), stuRow),
    h("label.f", h("span", "Day"), day),
    h("div.f", tp.el),
    h("label.check", { for: "pinchk" }, pin, h("span", "📌 Pin as important (shows at the top)")),
    h("p.hint", "Add tasks before they start to earn DP. Repeats every day? Use Routine instead."),
  ], {
    actions: close => {
      const save = h("button.btn.primary", t("Save"));
      save.onclick = busy(save, async () => {
        if (!title.value.trim()) throw new Error("Please write what you will do.");
        const { start: st0, minutes: m } = tp.get(); if (!(m >= 5 && m <= 720)) throw new Error("Pick 5 minutes to 12 hours.");
        const s = dhakaIso(day.value, st0); const e = new Date(new Date(s).getTime() + m * 60000).toISOString();
        if (!(await clashOk(day.value, s, e, tk?.id))) return;
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
        del.onclick = busy(del, async () => { if (await confirmBox("Delete this task?", tk.routine_id ? "Only this day. The weekly routine stays." : "You can undo it right after.", t("Delete"), true)) { if (tk.routine_id) await api.insert("routine_skips", { routine_id: tk.routine_id, day: tk.day, user_id: api.userId() }).catch(() => {}); await api.remove("tasks", `id=eq.${tk.id}`); import("./undo.js").then(U => U.removedTask(tk)); close(true); rerender(); } });
        btns.unshift(del);
      }
      return btns;
    },
  });
}
// two things at the same time, or over a prayer time? ask before saving
export async function clashOk(day, s, e, skipId = null) {
  const S = new Date(s).getTime(), E = new Date(e).getTime(), hits = [];
  try {
    const list = await api.selectFresh("tasks", `select=id,title,start_at,end_at,status&day=eq.${day}&status=eq.pending&is_timer=eq.false`);
    list.filter(x => x.id !== skipId && new Date(x.start_at) < E && new Date(x.end_at) > S).forEach(x => hits.push(`${x.title} (${fmtTime(x.start_at)} – ${fmtTime(x.end_at)})`));
  } catch { /* offline: skip the check */ }
  try {
    const P = await import("./prayer.js");
    if (P.isMuslim()) P.waqts(day).filter(w => w.start >= S && w.start < E).forEach(w => hits.push(`${w.bn} prayer (${fmtTime(new Date(w.start).toISOString())})`));
  } catch { /* fine */ }
  if (!hits.length) return true;
  return confirmBox("Time clash", "Overlaps with: " + hits.join(", "), "Save anyway");
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
      const W = (pom.work || 25) * 60, B = (pom.brk || 5) * 60, cyc = sec % (W + B), inFocus = cyc < W;
      const left = inFocus ? W - cyc : W + B - cyc;
      phase.textContent = `${inFocus ? "🎯 Focus" : "☕ Break"} · ${pad(Math.floor(left / 60))}:${pad(left % 60)} left · round ${Math.floor(sec / (W + B)) + 1}`;
      if (sec > 0 && (cyc === 0 || cyc === W)) notify(cyc === W ? `Break — ${pom.brk || 5} min ☕` : `Focus — ${pom.work || 25} min 🎯`);
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
  const cats = catNames();
  const cat = h("select.input", cats.map(n => h("option", { value: n, selected: n === "Study + Class" }, n)));
  let mode = "free", work = 25, brk = 5;
  const presets = [[25, 5], [50, 10], [90, 15]];
  const pBox = h("div");
  const wIn = h("input.input", { type: "number", min: "5", max: "180", value: work, inputmode: "numeric" });
  const bIn = h("input.input", { type: "number", min: "1", max: "60", value: brk, inputmode: "numeric" });
  wIn.oninput = () => { work = Math.min(180, Math.max(5, Number(wIn.value) || 25)); drawP(); };
  bIn.oninput = () => { brk = Math.min(60, Math.max(1, Number(bIn.value) || 5)); drawP(); };
  const chips = h("div.row.wrap", { style: { gap: "6px" } });
  const drawP = () => chips.replaceChildren(...presets.map(([w, b]) => h("button.chip" + (w === work && b === brk ? ".on" : ""), { type: "button", onclick: () => { work = w; brk = b; wIn.value = w; bIn.value = b; drawP(); } }, `${w} + ${b}`)));
  drawP();
  pBox.append(chips, h("div.grid2", { style: { marginTop: "8px" } }, h("label.f.mb0", h("span", "Focus (min)"), wIn), h("label.f.mb0", h("span", "Break (min)"), bIn)));
  pBox.style.display = "none";
  const seg = h("div.seg", [["free", "⏱️ Free timer"], ["pomo", "🍅 Pomodoro"]].map(([k, l]) => h("button" + (k === mode ? ".on" : ""), { type: "button", onclick: e => { mode = k; seg.querySelectorAll("button").forEach(b => b.classList.toggle("on", b === e.currentTarget)); pBox.style.display = k === "pomo" ? "" : "none"; } }, l)));
  return sheet("⏱️ Timer", [
    h("label.f", h("span", "What are you doing?"), title), seg, h("div", { style: { height: "10px" } }), pBox,
    h("details.ai-fold", h("summary", "Category"), h("div", { style: { marginTop: "8px" } }, cat)),
  ], {
    actions: close => {
      const go_ = h("button.btn.primary", icon("play"), "Start");
      go_.onclick = busy(go_, async () => {
        let id;
        const tt = title.value.trim() || (mode === "pomo" ? "Pomodoro" : "Focus session");
        try { id = await api.rpc("start_timer", { p_title: tt, p_category: cat.value }); }
        catch (e) {
          if (!e.offline) throw e;
          id = "local"; api.LS.set("al_localtimer", { title: tt, category: cat.value, start: new Date().toISOString() });
          toast("Offline timer started — it will sync later ✓", "ok");
        }
        if (mode === "pomo") {
          api.LS.set("al_pomo", { id, work, brk });
          // the server sends "break / focus again" notifications too, so they come even with the app closed
          if (id !== "local") api.rpc("set_pomo", { p_task: id, p_work: Math.round(work), p_break: Math.round(brk) }).catch(() => {});
        } else api.LS.del("al_pomo");
        askNotify(); close(true); go("#/today"); rerender();
      });
      return [h("button.btn", { onclick: () => close(null) }, t("Cancel")), go_];
    },
  });
}

// ---------- in-app reminders (while the app is open)
function askNotify() { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); }
function notify(msg) {
  chime("urgent"); toast(msg); // phone notifications come from the server (push), so inside the app just show a toast
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
  clearTimeout(tickTimer);
  const box = h("button.ticker", { type: "button", onclick: () => askSheet(), "aria-label": "Open AI" });
  const items = () => {
    const c = api.LS.get("al_coach") || {};
    const list = [...(c.alerts || []).map(a => ({ ic: "⚠️", t: a.title, d: a.text, warn: true })), ...(c.tips || []).map(x => ({ ic: "💡", t: x.title, d: x.text }))];
    for (let k = 0; k < 2; k++) { const [q, by] = quoteFor(store.profile?.occupation, today, k); list.push({ ic: "❝", t: q, d: by, quote: true }); }
    return list;
  };
  let i = Number(api.LS.get("al_tick_i", 0)) || 0;
  const show = () => {
    const L = items(); if (!L.length) return 7000;
    const it = L[i % L.length];
    const line = h("span.tk-in" + (it.quote ? ".quote" : ""), h("span.tk-ic", it.ic), h("span.tk-txt", h("b", it.t), it.d ? h("span", it.quote ? "— " + it.d : it.d) : null));
    box.classList.toggle("warn", !!it.warn);
    const old = box.querySelector(".tk-in:not(.tk-out)");
    if (old) { old.classList.add("tk-out"); setTimeout(() => old.remove(), 300); }
    box.append(line);
    i++; api.LS.set("al_tick_i", i % 1000);
    return Math.min(15000, 5000 + ((it.t || "").length + (it.d || "").length) * 45); // longer lines stay longer
  };
  clearTimeout(tickTimer);
  const loop = ms => { tickTimer = setTimeout(() => { if (!document.body.contains(box)) return; loop(document.hidden ? 3000 : show()); }, ms); };
  loop(show());
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
  const opt = (ic, title, sub, fn) => { const b = h("button.li", { style: { textAlign: "left" } }, h("div.ic", ic), h("div.grow", h("b", title), h("div.small.muted", sub))); b.onclick = () => { [...document.querySelectorAll(".backdrop")].pop()?.click(); setTimeout(fn, 230); }; return b; };
  sheet("Edit “" + tk.title + "”", [h("div.list",
    opt("1️⃣", "Only this week", `Change just ${fmtDate(tk.day, { weekday: "long", day: "numeric", month: "short" })}. Other weeks stay the same.`, () => addTask(tk)),
    r.source === "timetable"
      ? opt("🔁", "Every week", "This comes from your class timetable — change it there for all weeks.", () => { location.hash = `#/schedule/${r.category === "Tuition" ? "coaching" : "university"}`; })
      : opt("🔁", "Every week", "Change the routine itself — all coming weeks.", () => import("./more.js").then(m => m.editRoutine(r))))],
    { actions: close => [h("button.btn", { onclick: () => close(null) }, t("Cancel"))] });
}
