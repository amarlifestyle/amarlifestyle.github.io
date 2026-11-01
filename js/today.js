// Amar Lifestyle — Today page, tasks, timer, Pomodoro
import * as api from "./api.js";
import { h, icon, t, toast, sheet, confirmBox, busy, ring, todayStr, addDays, fmtTime, fmtHM, mins, durLabel, dhakaIso, pad, dhakaNow, fmtDate } from "./ui.js";
import { route, store, catColor, catNames, catDp, rerender, go, occupationPicker, saveOccupation } from "./app.js";
import { coachCard } from "./aicoach.js";
import { quoteFor } from "./quotes.js";

const unlockAt = tk => new Date(new Date(tk.start_at).getTime() + (new Date(tk.end_at) - new Date(tk.start_at)) * Number(store.cfg.unlock_fraction ?? 0.75));
const lateEnd = tk => new Date(new Date(tk.end_at).getTime() + Number(store.cfg.late_window_min ?? 30) * 60000);

function greeting() {
  const hr = dhakaNow().getHours();
  return hr < 5 ? "Good night" : hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
}

route("today", async page => {
  const today = todayStr();
  const first = (store.profile?.name || "").split(" ")[0];
  page.append(h("header.topbar",
    h("div", h("h1", `${greeting()}, ${first}`), h("div.sub", fmtDate(today, { weekday: "long", day: "numeric", month: "long" }))),
    h("button.icon-btn", { onclick: openTimer, "aria-label": t("Start timer"), title: t("Start timer") }, icon("timer"))));

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
  const pct = realTasks.length ? doneN / realTasks.length : 0;
  if (realTasks.length && (nowMin >= sleepMin - 30 || nowMin < 240)) {
    body.append(h("div.card", { style: { background: "linear-gradient(135deg, color-mix(in srgb, var(--cyan) 14%, var(--card)), var(--card))" } },
      h("h3", "🌙 Today's report"),
      h("div.big", `${Math.round(pct * 100)}% tasks done`),
      h("p.muted.mb0", `${doneN} of ${realTasks.length} tasks · ${stats.today.dp >= 0 ? "+" : ""}${stats.today.dp} DP · ${stats.today.coins} coins today. `,
        pct >= 0.8 ? "Great discipline — streak kept! 🔥" : "Tomorrow is a new chance. Mark the rest before 12 AM.")));
  }

  // running timer
  const running = tasks.find(x => x.status === "running") || (localTimer && { ...localTimer, id: "local", status: "running", start_at: localTimer.start, local: true });
  if (running) body.append(runningBar(running));

  // hero
  const lv = stats.level;
  const toNext = lv.next ? `${lv.next_min - stats.month_dp} DP to ${lv.next}` : "Top level this month!";
  // ask once what they do, so categories fit them
  if (!store.profile?.occupation) {
    const card = h("div.card", { style: { borderColor: "color-mix(in srgb, var(--brand) 45%, transparent)" } },
      h("b", "আপনি কী করেন?"), h("p.small.muted", { style: { margin: "4px 0 8px" } }, "এটা বেছে নিলে আপনার কাজের ধরন অনুযায়ী ক্যাটাগরি দেখাবে (পরে Settings → Profile থেকে বদলানো যাবে)।"),
      occupationPicker(null, async k => { try { await saveOccupation(k); toast("Saved ✓", "ok"); rerender(); } catch (e) { toast(e.message, "bad"); } }));
    body.append(card);
  }

  // compact summary strip (tasks get the space)
  body.append(h("div.hero.mini",
    ring(pct, `${Math.round(pct * 100)}%`, ""),
    h("div.grow", { style: { minWidth: 0 } },
      h("div", h("b.mid", (stats.today.dp >= 0 ? "+" : "") + stats.today.dp, " DP"), h("span.small.muted", ` · ${doneN}/${realTasks.length} tasks`)),
      h("div.small.muted.ell", toNext)),
    h("div.col-end",
      h("a.level-pill", { href: "#/me" }, icon("medal"), lv.name),
      h("span.small.muted", "🔥 ", stats.streak, "d"))));
  // up next — a reason to come back
  const upNext = realTasks.find(x => x.status === "pending" && new Date(x.start_at) > new Date());
  if (upNext) {
    const m = Math.round((new Date(upNext.start_at) - new Date()) / 60000);
    body.append(h("div.small.muted", { style: { margin: "-2px 4px 8px" } }, "⏭ Next: ", h("b", { style: { color: catColor(upNext.category) } }, upNext.title), ` at ${fmtTime(upNext.start_at)} · in ${m >= 60 ? Math.floor(m / 60) + "h " : ""}${m % 60}m`));
  }
  if (navigator.onLine) body.append(coachCard());
  // quote of the day (tap for another)
  let qShift = 0;
  const qBox = h("div.quote", { role: "button", tabindex: "0", title: "Tap for another" });
  const drawQ = () => { const [q, by] = quoteFor(store.profile?.occupation, today, qShift); qBox.replaceChildren(h("span", "“", q, "”"), h("span.by", " — ", by)); };
  qBox.onclick = () => { qShift++; drawQ(); };
  drawQ(); body.append(qBox);

  // today's events + countdowns
  const evToday = events.filter(e => e.kind !== "countdown" && (e.date === today || (e.yearly && e.date.slice(5) === today.slice(5))));
  const cds = events.filter(e => e.kind === "countdown" && e.date >= today).slice(0, 3);
  if (evToday.length || cds.length) {
    body.append(h("div.row.wrap", { style: { gap: "8px", marginBottom: "14px" } },
      evToday.map(e => h("span.badge.warn", e.kind === "birthday" ? "🎂 " : e.kind === "meeting" ? "🤝 " : "📌 ", e.title, e.time ? " · " + fmtHM(e.time) : "")),
      cds.map(e => { const d = Math.round((new Date(e.date) - new Date(today)) / 864e5); return h("span.badge", "⏳ ", e.title, ": ", d === 0 ? "today" : `${d} day${d > 1 ? "s" : ""}`); })));
  }

  // task list
  body.append(h("div.section-title", h("h2", "Today's tasks"), h("a.small", { href: "#/routine" }, "Set routine")));
  if (!realTasks.length && !running) {
    body.append(h("div.card.empty", icon("today"), h("p", "No tasks today."),
      h("p.small", "Tap ＋ to add one, or set a daily routine so tasks appear by themselves."),
      h("div.row", { style: { justifyContent: "center" } }, h("button.btn.primary", { onclick: () => addTask() }, icon("plus"), t("Add task")), h("a.btn", { href: "#/routine" }, icon("routine"), t("Routine")))));
  } else {
    if (!api.LS.get("al_tip_seen")) {
      const tip = h("div.card.small", h("b", "How it works: "), "Mark a task in its last quarter (a 1-hour task opens 15 min before it ends). Mark within 30 min after it ends for full DP. Unmarked tasks lose DP at 12 AM.",
        h("div", h("button.linkbtn", { onclick: () => { api.LS.set("al_tip_seen", 1); tip.remove(); } }, "Got it")));
      body.append(tip);
    }
    tasks.filter(x => x.status !== "running").forEach(tk => body.append(taskCard(tk, queued.has(tk.id))));
  }
  body.append(h("p.center.small.faint.mt", "Unplanned work? Use ", h("button.linkbtn", { onclick: openTimer }, "the timer"), " to earn DP."));
  notifyLoop(tasks);
}, { tab: "today" });

// ---------- task card
function taskCard(tk, queued) {
  const c = catColor(tk.category);
  const nowD = new Date();
  const ul = unlockAt(tk), le = lateEnd(tk);
  const el = h("div.task" + (["completed", "late_completed"].includes(tk.status) || queued ? ".done" : ""), { style: { "--c": c } });
  const status = {
    completed: h("span.badge.ok", "✓ +" + tk.dp_awarded + " DP" + (tk.photo_bonus ? " 📷" : "")),
    late_completed: h("span.badge.warn", "✓ Done late · 0 DP"),
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
      bC.onclick = busy(bC, () => mark(tk, "completed"));
      bN.onclick = busy(bN, async () => { if (await confirmBox("Not completed?", `Being honest costs half: −${Math.floor(tk.dp_value / 2)} DP. Leaving it unmarked costs −${tk.dp_value} DP at 12 AM.`, "Yes, not completed")) await mark(tk, "not_completed"); });
      acts.append(bC, bN);
      if (late) acts.append(h("div.lockline", icon("info"), "Late now: marking Completed gives 0 DP, but counts as done."));
      else if (nowD > new Date(tk.end_at)) acts.append(h("div.lockline", icon("info"), `Full DP until ${fmtTime(le.toISOString())} (half coins).`));
    }
  } else if (tk.status === "completed" && tk.dp_awarded > 0 && !tk.photo_path) {
    const inp = h("input", { type: "file", accept: "image/*", capture: "environment", hidden: true });
    const b = h("button.btn.small", icon("camera"), `Add photo (+${store.cfg.photo_bonus_dp ?? 2} DP)`);
    inp.onchange = busy(b, async () => {
      if (!inp.files[0]) return;
      const path = await api.uploadProof(inp.files[0], tk.id);
      const bonus = await api.rpc("add_photo", { p_task: tk.id, p_path: path });
      toast(bonus ? `Photo saved · +${bonus} DP 📷` : "Photo saved", "ok"); rerender();
    });
    b.onclick = () => inp.click();
    acts.append(b, inp);
  } else if (tk.photo_path) {
    const b = h("button.btn.small.ghost", icon("camera"), "View photo");
    b.onclick = busy(b, async () => { const u = await api.signedUrl(tk.photo_path); sheet(tk.title, h("img", { src: u, alt: "Proof photo", style: { borderRadius: "14px" } })); });
    acts.append(b);
  }
  el.append(h("div.grow",
    h("div.row.between", h("div.t", tk.pinned ? h("span.pin", "📌 ") : null, tk.title), status || h("span.dp", `${tk.is_timer ? "" : tk.dp_value + " DP"}`)),
    h("div.meta", h("span", `${fmtTime(tk.start_at)} – ${fmtTime(tk.end_at)}`), h("span", "·"), h("span", tk.category), tk.is_timer ? h("span", "· timer") : null),
    acts));
  if (tk.offlineNew) el.querySelector(".meta")?.append(h("span.warn", "· saved offline"));
  if (tk.status === "pending" && !queued && !tk.offlineNew) el.addEventListener("click", e => { if (!e.target.closest("button,input")) addTask(tk); });
  return el;
}

async function mark(tk, result) {
  if (tk.offlineNew) { api.queueMark(tk.id, result); toast("Saved offline. It will sync when you're online.", "ok"); rerender(); return; }
  try {
    const r = await api.rpc("complete_task", { p_task: tk.id, p_result: result });
    if (r.status === "completed") toast(r.no_dp_reason === "added_after_start" ? "Done ✓ — no DP (task was added after it started)" : `Great! +${r.dp} DP · +${r.coins} coins 🎉`, "ok");
    else if (r.status === "late_completed") toast("Marked done (late) — no DP this time.", "");
    else toast(`Noted. ${r.dp} DP`, "");
    if (navigator.vibrate) navigator.vibrate(30);
    rerender();
  } catch (e) {
    if (e.offline) { api.queueMark(tk.id, result); toast("Saved offline. It will sync when you're online.", "ok"); rerender(); }
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
        del.onclick = busy(del, async () => { if (await confirmBox("Delete this task?", "This cannot be undone.", t("Delete"), true)) { await api.remove("tasks", `id=eq.${tk.id}`); toast("Deleted"); close(true); rerender(); } });
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
  try { if ("Notification" in window && Notification.permission === "granted") new Notification("Amar Lifestyle", { body: msg, icon: "assets/icon-192.png" }); else toast(msg); } catch { toast(msg); }
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
      if (now >= s - 10 * 60000 && now < s && !fired.has(k1)) { fired.add(k1); notify(`In 10 min: ${tk.title}`); }
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
