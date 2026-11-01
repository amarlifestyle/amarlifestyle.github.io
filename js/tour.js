// Amar Lifestyle — first-time guide: what each part does, one step at a time
import * as api from "./api.js";
import { h, sheet } from "./ui.js";
import { store } from "./app.js";
import { showTuition } from "./app.js";
import { deadlines } from "./exams.js";

const steps = () => [
  ["👋", "Amar Lifestyle-এ স্বাগতম", ["এখানে আপনার দিনের রুটিন, পড়াশোনা, কাজ আর টাকার হিসাব এক জায়গায় থাকবে।", "প্রতিটা কাজ ঠিক সময়ে শেষ করলে পাবেন DP (Discipline Points) — এটাই আপনার নিয়মানুবর্তিতার মাপ।", "⚠️ এই অ্যাপে অনেক কিছু করা যায়, যা প্রথমে চোখে পড়ে না। তাই পুরো গাইডটা Next চেপে চেপে একবার দেখে নিন — পরে চালাতে অনেক সহজ হবে।"]],
  ["✅", "Today — আজকের কাজ", ["আজকের সব টাস্ক সময় অনুযায়ী এখানে থাকে।", "টাস্কের শেষ অংশে (যেমন ১ ঘণ্টার কাজে শেষ ১৫ মিনিটে) Completed / Not Completed বাটন খোলে; শেষ হওয়ার পর ৫ ঘণ্টা পর্যন্ত মার্ক করলেও পুরো DP পাবেন।", "Completed চাপলে বেছে নিন কতটুকু হয়েছে — 25%, 50%, 75% বা 100%; DP আর কয়েন সেই অনুপাতে পাবেন।", "রাত ১২টার আগে Not Completed দিলে কিছু কাটে না (0 DP); কিছুই মার্ক না করলে রাত ১২টায় পুরো DP কাটে।"]],
  ["🚨", "Up next ও Emergency", ["উপরের “Up next” কার্ড দেখায় পরের কাজ কোনটা আর কত সময় বাকি।", "হঠাৎ জরুরি কাজ এলে “🚨 Emergency” চাপুন — সময় আর কতক্ষণ লাগবে দিন।", "তখন যে টাস্ক চলছিল, সেটা ইমার্জেন্সির শুরুতে নিজে থেকেই শেষ হয়ে যায়, আর ইমার্জেন্সি সবার উপরে দেখায়।"]],
  ["✨", "AI — আপনার সহকারী", ["Today-র উপরে গোল ✨ AI বোতাম। Today-তে এক লাইনের পরামর্শ কয়েক সেকেন্ড পরপর বদলায় — রুটিন, টাকা, পরীক্ষা সব দেখে।", "AI-কে লিখে, মাইকে বলে (বাংলা/ইংরেজি) বা ছবি দিয়ে বলুন — সে নিজেই অ্যাপে কাজ করে দেবে।"]],
  ["🤖", "AI দিয়ে যা যা করা যায়", ["টাস্ক যোগ / বাদ / সময় বদল / Completed মার্ক — “আজ Leon নাই বাদ দাও”", "রুটিন বানানো — “শনি, সোম বিকাল ৫টায় Physics পড়াই” বা রুটিনের ছবি দিন", "টাকা — “২০০ টাকা রিকশা ভাড়া”, “Leon অক্টোবরের ফি দিছে”, বিল লিখে রাখা", "অভ্যাস — “আজ ৩টা সিগারেট খেয়েছি, একটা ১৫ টাকা”", "ক্যালেন্ডার, লক্ষ্য, পাওনা-দেনা, নতুন ক্যাটাগরি/স্টুডেন্ট", "“এই অ্যাপে কী কী ফিচার আছে?” জিজ্ঞেস করুন — বুঝিয়ে দেবে। সব কাজ আগে দেখায়, “হ্যাঁ, করো” চাপলে তবেই হয়।"]],
  ["📅", "Routine — সাপ্তাহিক রুটিন", ["একবার রুটিন বানালে প্রতি সপ্তাহে টাস্ক নিজে থেকেই আসে।", "যেকোনো বক্সে চাপুন: Edit, Remove, বা ↕ Move দিয়ে আগে-পরে সরান / পাশেরটার সাথে জায়গা বদলান।", "উপরে ট্যাব যোগ করা যায় — University, Coaching ইত্যাদি। রুটিনের ছবি দিলে AI নিজেই পড়ে বানিয়ে দেয়।", `${deadlines().tab} ট্যাবে সামনের জরুরি কাজগুলো দিন (${deadlines().sub}) — তারিখ যত কাছে আসবে, রিমাইন্ডার তত ঘন ঘন আসবে।`]],
  ...(store.profile?.religion === "muslim" ? [["🕌", "Prayer — নামাজ", ["Routine → 🕌 Prayer-এ আজকের পাঁচ ওয়াক্তের সময় (ইসলামিক ফাউন্ডেশনের পদ্ধতিতে, সাবধানতার কয়েক মিনিট যোগ করে)।", "যে ওয়াক্ত চলছে সেটা Today-তে ছোট করে দেখায় — Prayed বা Not prayed চাপুন।", "Prayed = ফজর +১০, অন্যগুলো +৮ DP · Not prayed = কিছু কাটে না · মার্ক না করলে পরদিন সকাল ৬টায় সমান DP কাটে।"]]] : []),
  ["৳", "Money — টাকার হিসাব", ["আয় আর খরচ লিখুন — Rent, Bills, Food, Transport ইত্যাদি ভাগে।", ...(showTuition() ? ["Tuition: প্রতিটা স্টুডেন্টের মাসিক ফি, কোন মাস বাকি, শিটের মতো দেখা যায়।"] : []), "Daily spending: ভাড়া, খাবার, চা, সিগারেট — এক চাপে টাকা লিখুন; আজ আর এই মাসে কত গেল দেখায়।", "আগে থেকে দেওয়ার বিল লিখে রাখুন; দেওয়া হলে টিক দিন — খরচে যোগ হয়ে যায়।", "কোনো মাসের হিসাব মাস শেষের ৩০ দিন পর্যন্ত বদলানো যায়; সব পরিবর্তনের ইতিহাস থাকে।"]],
  ["🏅", "Me — লেভেল ও অভ্যাস", ["প্রতি মাসে DP দিয়ে লেভেল: Bronze → Silver → Gold → Platinum → Diamond। ১ তারিখে নতুন করে শুরু।", "টানা দিন ভালো করলে streak বাড়ে, ব্যাজ পাবেন।", "ঘুম, পানি, অভ্যাস আর ডায়েরি এখানে। বদভ্যাসে দাম দিলে (যেমন সিগারেট ১৫ টাকা) দিন/মাসে কত টাকা গেল গ্রাফে দেখায়।"]],
  ["📊", "Daily report — দিনের হিসাব", ["Today-র উপরের সারাংশে (রিং) চাপলে আজকের পুরো রিপোর্ট: কত কাজ হলো, কত ঘণ্টা, কত DP, আয়-খরচ, নামাজ, অভ্যাস।", "সাথে AI বলে দেয় দিনটা কেমন গেল — কী ভালো করেছেন, কোথায় ভুল হয়েছে, কাল কী করবেন।", "ঘুমের ৩০ মিনিট আগে নোটিফিকেশন আসে, Today-তেও “🌙 Today’s report” কার্ড দেখায়। ঘুমের সময় ঠিক রাখুন: Me → Edit profile → Bedtime।"]],
  ["🗓️", "Calendar — এক্সট্রা ক্লাস ও ইভেন্ট", ["More → Calendar-এ এক্সট্রা ক্লাস দিন — ওই দিন Today-তে টাস্ক হয়ে আসবে, DP আর রিমাইন্ডার সহ।", "জন্মদিন আর মিটিংও রাখা যায়।"]],
  ["🔔", "নোটিফিকেশন চালু করুন", ["More → Settings → Notifications চালু করুন। পাসওয়ার্ড ভুলে গেলে সহজে ফেরত পেতে Telegram-ও কানেক্ট করে রাখুন।", "প্রতিটা টাস্কের ৩০ ও ১৫ মিনিট আগে, শুরুতে, আর পড়ার সময় প্রতি ৩০ মিনিটে মনে করিয়ে দেবে।", "iPhone-এ আগে Safari-র Share → “Add to Home Screen” দিয়ে অ্যাপটা হোম স্ক্রিনে রাখুন।"]],
  ["🚀", "শুরু করুন", ["প্রথমে Routine-এ আপনার সাপ্তাহিক রুটিন বানান (নিজে লিখে, AI-কে বলে, বা ছবি দিয়ে)।", "তারপর প্রতিদিন Today থেকে কাজ মার্ক করুন।", "এই গাইড আবার দেখতে: More → How to use। গাইড শেষে স্ক্রিনের প্রতিটা অংশ দাগ দিয়ে দেখিয়ে দেবে কোথায় কী আছে।"]],
];

export function showTour(force = false) {
  if (!force && api.LS.get("al_tour_v3")) return;
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
    api.LS.set("al_tour_v3", 1);
    // then point at each part of the Today screen
    if (location.hash.startsWith("#/today") || location.hash === "" || location.hash === "#/") setTimeout(() => import("./spots.js").then(m => m.showSpots(force)), 350);
  });
  draw();
}
