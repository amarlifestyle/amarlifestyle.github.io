// Amar Lifestyle — voice: speak a routine line and the form fills itself.
// e.g. "শনিবার বিকাল ৫টা সিপি টিউশন ১ ঘণ্টা প্রতি সপ্তাহে" or "Monday 9 pm study 2 hours this week"
import { h, icon, toast, pad } from "./ui.js";
import { LS } from "./api.js";

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const toAscii = s => s.replace(/[০-৯]/g, d => BN_DIGITS.indexOf(d));

const DAY_WORDS = [
  [6, /(শনি|sat(urday)?)/i], [0, /(রবি|sun(day)?)/i], [1, /(সোম|mon(day)?)/i], [2, /(মঙ্গল|tue(s(day)?)?)/i],
  [3, /(বুধ|wed(nesday)?)/i], [4, /(বৃহস্পতি|বিষ্যুদ|thu(r(s(day)?)?)?)/i], [5, /(শুক্র|fri(day)?)/i],
];
const EVERY_DAY = /(প্রতিদিন|প্রত্যেক দিন|রোজ|every ?day|daily)/i;
const PERM = /(প্রতি সপ্তাহ|প্রত্যেক সপ্তাহ|প্রতি সপ্তাহে|সবসময়|সব সময়|পার্মানেন্ট|স্থায়ী|every ?week|weekly|permanent|always)/i;
const ONCE = /(শুধু এই সপ্তাহ|এই সপ্তাহ|এই সপ্তাহে|শুধু এবার|this week|only)/i;
const CATS = [
  ["Tuition", /(টিউশন|টিউশনি|পড়ানো|পড়াবো|প্রাইভেট|tuition|private|teach)/i],
  ["Gym / Running", /(জিম|দৌড়|রানিং|ব্যায়াম|ব্যায়াম|gym|run(ning)?|exercise|workout)/i],
  ["Study + Class", /(পড়া|পড়ালেখা|পড়াশোনা|স্টাডি|ক্লাস|study|class|read|revision)/i],
];

const STOP = new Set(["বার", "বারে", "বারের", "এ", "তে", "সকাল", "সকালে", "দুপুর", "দুপুরে", "বিকাল", "বিকেল", "বিকালে", "বিকেলে", "সন্ধ্যা", "সন্ধ্যায়", "সন্ধা", "রাত", "রাতে", "ভোর", "ভোরে",
  "at", "on", "from", "for", "and", "এবং", "ও", "day", "days", "every", "week", "সপ্তাহে", "সপ্তাহ", "প্রতি", "শুধু", "this", "only", "morning", "evening", "night", "afternoon", "noon"]);
export function parseLine(raw, students = [], categories = []) {
  const text = toAscii(raw.toLowerCase()).replace(/[,।!?]/g, " ");
  const out = { days: [], time: null, duration: null, category: null, studentId: null, title: "", repeat: null };

  if (EVERY_DAY.test(text)) out.days = [0, 1, 2, 3, 4, 5, 6];
  else DAY_WORDS.forEach(([d, re]) => { if (re.test(text)) out.days.push(d); });
  if (PERM.test(text) || EVERY_DAY.test(text)) out.repeat = "perm";
  else if (ONCE.test(text)) out.repeat = "week";

  // duration first (so "2 ঘণ্টা" isn't read as a time)
  let dur = null, rest = text;
  const durRes = [
    [/দেড় ?(ঘণ্টা|ঘন্টা)/, () => 90], [/আড়াই ?(ঘণ্টা|ঘন্টা)/, () => 150], [/আধা ?(ঘণ্টা|ঘন্টা)|half ?(an )?hour/, () => 30],
    [/(\d+(?:\.\d+)?)\s*(ঘণ্টা|ঘন্টা|hours?|hrs?|h\b)/, m => Math.round(parseFloat(m[1]) * 60)],
    [/(\d+)\s*(মিনিট|minutes?|mins?)/, m => parseInt(m[1])],
  ];
  for (const [re, f] of durRes) { const m = rest.match(re); if (m) { dur = f(m); rest = rest.replace(m[0], " "); break; } }
  out.duration = dur;

  // time
  let m = rest.match(/(সাড়ে)?\s*(\d{1,2})(?:\s*[:.]\s*(\d{2}))?\s*(টা|টায়|টার|am|pm|a\.m\.|p\.m\.)?/);
  const tm = [...rest.matchAll(/(সাড়ে)?\s*(\d{1,2})(?:\s*[:.]\s*(\d{2}))?\s*(টা|টায়|টার|am|pm|a\.m\.|p\.m\.)/g)][0] || m;
  if (tm && tm[2]) {
    let H = parseInt(tm[2]), M = tm[3] ? parseInt(tm[3]) : tm[1] ? 30 : 0;
    const suf = (tm[4] || "").replace(/\./g, "");
    const before = rest.slice(0, rest.indexOf(tm[0]));
    if (suf === "pm" && H < 12) H += 12;
    else if (suf === "am" && H === 12) H = 0;
    else if (suf !== "am" && suf !== "pm") {
      if (/(বিকাল|বিকেল|সন্ধ্যা|সন্ধা|সন্ধ্যায়|evening|afternoon)/.test(before) && H < 12) H += 12;
      else if (/(দুপুর|noon)/.test(before)) { if (H < 5) H += 12; }
      else if (/(রাত|রাতে|night)/.test(before)) { if (H >= 6 && H < 12) H += 12; }
      else if (/(সকাল|ভোর|morning)/.test(before)) { /* keep */ }
      else if (H >= 1 && H <= 6) H += 12; // "5টা" with no word usually means 5 PM
    }
    if (H <= 23 && M <= 59) out.time = `${pad(H)}:${pad(M)}`;
  }

  // student → Tuition
  const st = students.find(s => s.name && text.includes(s.name.toLowerCase().replace(/[^a-z0-9ঀ-৿ ]/g, "").trim()) ||
    text.replace(/[.\s]/g, "").includes(s.name.toLowerCase().replace(/[.\s]/g, "")));
  if (st) { out.studentId = st.id; out.category = "Tuition"; out.title = st.name; }
  if (!out.category) {
    const own = categories.find(c => text.includes(c.toLowerCase()));
    out.category = own || (CATS.find(([, re]) => re.test(text)) || [])[0] || null;
  }
  if (!out.title) {
    let t = raw;
    [EVERY_DAY, PERM, ONCE, ...DAY_WORDS.map(d => d[1])].forEach(re => t = t.replace(new RegExp(re.source, "gi"), " "));
    t = toAscii(t).replace(/(সাড়ে)?\s*\d{1,2}([:.]\d{2})?\s*(টা|টায়|টার|am|pm)?/gi, " ")
      .replace(/(দেড়|আড়াই|আধা)?\s*(ঘণ্টা|ঘন্টা|hours?|hrs?|মিনিট|minutes?|mins?)/gi, " ")
      .split(/\s+/).filter(w => w && !STOP.has(w.toLowerCase())).join(" ").trim();
    out.title = t.length > 1 ? t.slice(0, 60) : (out.category || "Task");
  }
  return out;
}

// microphone button: tap, speak, get text
export function micButton(onText) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const lang = () => LS.get("al_voice_lang", "bn-BD");
  const b = h("button.btn.small", { type: "button", "aria-label": "Speak" }, icon("mic"), "Speak");
  const lb = h("button.btn.small.ghost", { type: "button", "aria-label": "Voice language" }, lang() === "bn-BD" ? "বাংলা" : "EN");
  lb.onclick = () => { LS.set("al_voice_lang", lang() === "bn-BD" ? "en-US" : "bn-BD"); lb.textContent = lang() === "bn-BD" ? "বাংলা" : "EN"; };
  b.onclick = () => {
    if (!SR) { toast("Voice isn't supported in this browser. Use Chrome, or type the line instead.", "bad"); return; }
    const r = new SR(); r.lang = lang(); r.interimResults = false; r.maxAlternatives = 1;
    b.classList.add("primary"); b.lastChild.textContent = "Listening…";
    r.onresult = e => onText(e.results[0][0].transcript);
    r.onerror = e => toast(e.error === "not-allowed" ? "Allow microphone access to use voice." : e.error === "network" ? "Voice needs internet." : "Didn't catch that. Try again.", "bad");
    r.onend = () => { b.classList.remove("primary"); b.lastChild.textContent = "Speak"; };
    try { r.start(); } catch { r.onend(); }
  };
  return h("div.row", { style: { gap: "6px" } }, b, lb);
}
