/* © 2026 Musfiqur Rahman. All rights reserved. Unauthorized copying is prohibited. Proprietary — see LICENSE. */
// Amar Lifestyle — first-time guide: what each part does, one step at a time
import * as api from "./api.js";
import { h, sheet } from "./ui.js";
import { store } from "./app.js";
import { showTuition } from "./app.js";
import { deadlines } from "./exams.js";

const study = () => (store.profile?.roles || [store.profile?.occupation]).some(r => ["student", "school"].includes(r));
// every slide; NEW marks the ones added in the latest update (shown once as "What's new" to people who saw the old guide)
const steps = () => [
  ["👋", "Welcome!", ["Please take 5 minutes for this guide — it helps you get the most out of the app."]],
  ["✅", "Today", ["Your tasks in order — the first one has a coloured countdown (blue later · amber soon · green running · red ending).", "Near the end of a task, tap Completed or Not Completed. Unmarked tasks lose DP at midnight.", "Finished tasks move to the bottom."]],
  ["📌", "The box on top of Today", ["Prayer, bills, events — and your next CT / lab / exam, always shown however far away.", "✕ or swipe left hides a row; ↶ Undo brings it back."], "NEW"],
  ["✨", "AI — the middle button", ["Type, speak (Bangla or English) or send a photo — a routine, an exam schedule, a book's contents page.", "It can do almost anything in the app; it shows the changes first and nothing happens until you confirm."]],
  ["📅", "Routine", ["Set it once, it repeats every week. Tabs on top: Weekly · " + deadlines().tab.replace(/^\S+\s/, "") + (study() ? " · Syllabus" : "") + " · classes.", "Deleted by mistake? Tap ↶ Undo."]],
  ["🗓️", deadlines().tab.replace(/^\S+\s/, "") + " — calendar", ["A month calendar shows what is due on each day; tap a day to see it.", "Below it, week by week. Items whose time is over leave the list after one day."], "NEW"],
  ...(study() ? [
    ["🏆", "Marks & results", ["After a CT or exam, tap ＋ Marks (Exams → Waiting for marks).", "Results shows your % per course and overall."], "NEW"],
    ["📚", "Syllabus & revision", ["Add your classes as subjects in one tap, or chapters from a photo. Mark chapters ★ important and add notes.", "Tick a chapter when it's done — revision reminders come on Day 1, 7, 15 and 30, on Today and as a notification."], "NEW"],
  ] : []),
  ["📝", "Notes", ["The 📝 button at the top right. Tick a note when done — it moves to History.", "Hold ⋮⋮ and drag to reorder; ✕ removes it (with Undo)."], "NEW"],
  ...(store.profile?.religion === "muslim" ? [["🕌", "Prayer", ["The current prayer shows on Today — tap Prayed to earn DP."]]] : []),
  ["💳", "Money", ["Income, spending and bills" + (showTuition() ? ", tuition fees and attendance" : "") + ".", "Editing money needs your PIN."]],
  ["🏅", "Me", ["This month's level, Bronze → Diamond, and each month of the year.", "Habits, water, sleep, mood and diary."]],
  ["🔔", "Turn on notifications", ["Tap 🔔 (top right) → Turn on.", "Connect Telegram for loud important reminders."]],
  ["🤝", "Connect your own Claude", ["⋯ More → Settings → Connect to Claude: make a key and add it in Claude.", "Then Claude can read and update your account — with the same rules as the app."], "NEW"],
  ["🚀", "Let's start", ["First set your routine — type it, tell AI, or send a photo.", "Replay any time: ⋯ More → How to use."]],
];

export function showTour(force = false) {
  if (!force && api.LS.get("al_tour_v5")) return;
  // saw the old guide → show only what's new, once
  const onlyNew = !force && api.LS.get("al_tour_v4");
  const all = steps();
  const S = onlyNew ? [["🎉", "What's new", ["A few new things since last time — take a quick look."]], ...all.filter(x => x[3] === "NEW")] : all;
  let i = 0;
  const box = h("div.tour");
  const draw = () => {
    const [ic, title, lines] = S[i];
    box.replaceChildren(
      h("div.tour-ic", ic),
      h("h3.tour-t", title),
      h("ul.tour-l", lines.map(l => h("li", l))),
      h("div.tour-dots", S.map((_, k) => h("i" + (k === i ? ".on" : "")))));
    box.classList.remove("tour-anim"); void box.offsetWidth; box.classList.add("tour-anim");
    back.style.visibility = i ? "visible" : "hidden";
    next.textContent = i === S.length - 1 ? "Start" : "Next";
  };
  const back = h("button.btn", { type: "button", onclick: () => { if (i) { i--; draw(); } } }, "Back");
  const next = h("button.btn.primary", { type: "button" }, "Next");
  let closeFn = null;
  next.onclick = () => { if (i < S.length - 1) { i++; draw(); } else closeFn?.(true); };
  const skip = h("button.linkbtn.small", { type: "button", onclick: () => closeFn?.(true), style: { display: "block", margin: "8px auto 0" } }, "Skip guide");
  sheet(onlyNew ? "What's new" : "How to use", [box, skip], { actions: close => { closeFn = close; return [back, next]; } }).then(() => {
    api.LS.set("al_tour_v4", 1); api.LS.set("al_tour_v5", 1);
    // then point at each part of the Today screen
    if (!onlyNew && (location.hash.startsWith("#/today") || location.hash === "" || location.hash === "#/")) setTimeout(() => import("./spots.js").then(m => m.showSpots(force)), 350);
  });
  draw();
}
