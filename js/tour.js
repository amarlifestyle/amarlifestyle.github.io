// Amar Lifestyle — first-time guide: what each part does, one step at a time
import * as api from "./api.js";
import { h, sheet } from "./ui.js";
import { store } from "./app.js";
import { showTuition } from "./app.js";
import { deadlines } from "./exams.js";

const steps = () => [
  ["👋", "স্বাগতম!", ["⏳ মাত্র ৫ মিনিট সময় দিয়ে গাইডটা দেখে নিন — তাহলে অ্যাপের সব সুবিধা পুরোপুরি কাজে লাগাতে পারবেন।"]],
  ["✅", "Today", ["আজকের সব কাজ সময় ধরে।", "কাজের শেষের দিকে Completed / Not Completed দিন — DP পাবেন।", "মার্ক না করলে রাত ১২টায় DP কাটে।"]],
  ["✨", "AI — মাঝের বাটন", ["লিখে, বাংলায় বলে বা ছবি দিয়ে বলুন: “আজ Leon-এর টিউশন নেই, বাদ দাও”।", "আগে দেখাবে কী করবে, “হ্যাঁ” চাপলেই হয়ে যাবে।"]],
  ["📅", "Routine", ["একবার রুটিন দিলে প্রতি সপ্তাহে নিজে আসে।", "ভার্সিটি ক্লাস, পরীক্ষা, Syllabus — উপরের ট্যাবে।", "ভুলে মুছলে ↶ Undo।"]],
  ...(store.profile?.religion === "muslim" ? [["🕌", "নামাজ", ["চলতি ওয়াক্ত Today-তে দেখায় — Prayed চাপলে DP।"]]] : []),
  ["💳", "Money", ["আয়-খরচ, Daily spending, বিল" + (showTuition() ? ", টিউশন ফি" : "") + "।", "টাকা এডিট করতে PIN লাগে।"]],
  ["🏅", "Me", ["এই মাসের লেভেল: Bronze → Diamond।", "অভ্যাস, ঘুম আর ডায়েরি।"]],
  ["🔔", "নোটিফিকেশন চালু করুন", ["উপরের ডানে 🔔 চাপুন → Turn on।", "Telegram কানেক্ট করলে জরুরি রিমাইন্ডার সাউন্ডসহ আসে।"]],
  ["🚀", "শুরু করুন", ["প্রথমে Routine-এ রুটিন দিন — নিজে লিখে, AI-কে বলে বা ছবি দিয়ে।", "গাইড আবার দেখতে: ⋯ More → How to use।"]],
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
