/* © 2026 Musfiqur Rahman. All rights reserved. Unauthorized copying is prohibited. Proprietary — see LICENSE. */
// Amar Lifestyle — first-time guide: what each part does, one step at a time
import * as api from "./api.js";
import { h, sheet } from "./ui.js";
import { store } from "./app.js";
import { showTuition } from "./app.js";
import { deadlines } from "./exams.js";

const steps = () => [
  ["👋", "Welcome!", ["Please take 5 minutes for this guide — it helps you get the most out of the app."]],
  ["✅", "Today", ["Your tasks for today, in order.", "Near the end of a task, tap Completed or Not Completed.", "Unmarked tasks lose DP at midnight."]],
  ["✨", "AI — the middle button", ["Type, speak (Bangla or English) or send a photo.", "It shows the changes first; nothing happens until you confirm."]],
  ["📅", "Routine", ["Set it once, it repeats every week.", "Classes, exams and syllabus are in the tabs on top.", "Deleted by mistake? Tap ↶ Undo."]],
  ...(store.profile?.religion === "muslim" ? [["🕌", "Prayer", ["The current prayer shows on Today — tap Prayed to earn DP."]]] : []),
  ["💳", "Money", ["Income, spending and bills" + (showTuition() ? ", tuition fees" : "") + "।", "Editing money needs your PIN."]],
  ["🏅", "Me", ["This month's level, Bronze → Diamond.", "Habits, sleep and diary."]],
  ["🔔", "Turn on notifications", ["Tap 🔔 (top right) → Turn on.", "Connect Telegram for loud important reminders."]],
  ["🚀", "Let's start", ["First set your routine — type it, tell AI, or send a photo.", "Replay: ⋯ More → How to use."]],
];

export function showTour(force = false) {
  if (!force && api.LS.get("al_tour_v4")) return;
  const S = steps();
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
  sheet("How to use", [box, skip], { actions: close => { closeFn = close; return [back, next]; } }).then(() => {
    api.LS.set("al_tour_v4", 1);
    // then point at each part of the Today screen
    if (location.hash.startsWith("#/today") || location.hash === "" || location.hash === "#/") setTimeout(() => import("./spots.js").then(m => m.showSpots(force)), 350);
  });
  draw();
}
