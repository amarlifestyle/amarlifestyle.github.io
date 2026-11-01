// Amar Lifestyle — voice: speak a routine line and the form fills itself.
// e.g. "শনিবার বিকাল ৫টা সিপি টিউশন ১ ঘণ্টা প্রতি সপ্তাহে" or "Monday 9 pm study 2 hours this week"
import { h, icon, toast, pad } from "./ui.js";

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

// microphone: records your voice and AI (Gemini) listens to it — works for Bangla and English,
// on iPhone/iPad Safari too (the browser's own speech typing doesn't know Bangla there).
const MAX_SEC = 90;
function toWav(buf) { // AudioBuffer → 16 kHz mono 16-bit WAV (small, every AI understands it)
  const rate = 16000, src = buf.getChannelData(0), ratio = buf.sampleRate / rate, n = Math.floor(src.length / ratio);
  const out = new DataView(new ArrayBuffer(44 + n * 2));
  const w = (o, t) => [...t].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); out.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt "); out.setUint32(16, 16, true);
  out.setUint16(20, 1, true); out.setUint16(22, 1, true); out.setUint32(24, rate, true); out.setUint32(28, rate * 2, true);
  out.setUint16(32, 2, true); out.setUint16(34, 16, true); w(36, "data"); out.setUint32(40, n * 2, true);
  let peak = 0.0001; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(src[Math.floor(i * ratio)]));
  const gain = Math.min(8, 0.9 / peak); // make quiet voices louder
  for (let i = 0; i < n; i++) { const v = Math.max(-1, Math.min(1, src[Math.floor(i * ratio)] * gain)); out.setInt16(44 + i * 2, v * 0x7fff, true); }
  return out.buffer;
}
const b64 = ab => { let s = ""; const u = new Uint8Array(ab); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };

// big button: tap to start, tap again to finish → onAudio({ mime, data }) (async, may throw)
// The button's inside never gets rebuilt while recording (on iPhone/iPad a tap on a replaced element is lost).
export function voiceRecorder(onAudio, { label = "Tap and speak" } = {}) {
  let rec = null, stream = null, chunks = [], timer = null, sec = 0, state = "idle", cancelled = false;
  const ico = icon("mic");
  const dot = h("span", { style: { width: "10px", height: "10px", borderRadius: "50%", background: "currentColor", display: "none", pointerEvents: "none" } });
  const txt = h("span", { style: { pointerEvents: "none" } }, label);
  ico.style.pointerEvents = "none";
  const b = h("button.btn", { type: "button", style: { width: "100%", minHeight: "52px", fontSize: "16px", gap: "10px", touchAction: "manipulation" } }, ico, dot, txt);
  const cancel = h("button.btn.small.ghost", { type: "button", style: { display: "none", margin: "6px auto 0" } }, "✕ Cancel");
  const hint = h("div.small.muted", { style: { textAlign: "center", marginTop: "4px" } }, "বাংলা, English বা মিশিয়ে বলুন — AI নিজে শুনে বুঝবে");
  const stopMic = () => { clearInterval(timer); timer = null; stream?.getTracks().forEach(t => t.stop()); stream = null; };
  const set = (st, text) => {
    state = st; txt.textContent = text;
    b.classList.toggle("rec", st === "rec");
    ico.style.display = st === "rec" ? "none" : "";
    dot.style.display = st === "rec" ? "inline-block" : "none";
    cancel.style.display = st === "rec" ? "block" : "none";
    b.disabled = st === "busy";
  };
  const reset = () => { stopMic(); rec = null; set("idle", label); };
  const finish = async () => {
    stopMic();
    if (cancelled) { reset(); return; }
    set("busy", "🤖 AI শুনছে…");
    try {
      const blob = new Blob(chunks, { type: rec?.mimeType || chunks[0]?.type || "audio/mp4" });
      if (blob.size < 1500) throw new Error("কিছু শোনা যায়নি। আবার চাপুন, কথা বলুন, তারপর আবার চাপুন।");
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const ab = await blob.arrayBuffer();
      const buf = await Promise.race([
        new Promise((ok, bad) => { const p = ctx.decodeAudioData(ab, ok, bad); if (p?.then) p.then(ok, bad); }),
        new Promise((_, bad) => setTimeout(() => bad(new Error("Couldn't read the recording. Try again.")), 15000)),
      ]);
      ctx.close?.();
      await onAudio({ mime: "audio/wav", data: b64(toWav(buf)) });
    } catch (e) { toast(e.message || "Voice failed. Try again.", "bad"); }
    reset();
  };
  const stopRec = () => { if (rec && rec.state !== "inactive") { set("busy", "🤖 AI শুনছে…"); try { rec.stop(); } catch { finish(); } } else reset(); };
  b.onclick = async () => {
    if (state === "busy") return;
    if (state === "rec") { stopRec(); return; }
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { toast("This browser can't record. Update Safari/Chrome, or type instead.", "bad"); return; }
    if (!navigator.onLine) { toast("Voice needs internet.", "bad"); return; }
    set("busy", "Starting mic…");
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
    catch { reset(); toast("Allow microphone: tap ‘aA’/🔒 in the address bar → Microphone → Allow.", "bad"); return; }
    chunks = []; sec = 0; cancelled = false;
    try {
      rec = new MediaRecorder(stream);
      rec.ondataavailable = e => { if (e.data?.size) chunks.push(e.data); };
      rec.onstop = finish;
      rec.start();
    } catch { reset(); toast("Couldn't start recording. Try again.", "bad"); return; }
    set("rec", "Listening… 0:00 — tap to finish");
    timer = setInterval(() => {
      if (!b.isConnected) { cancelled = true; stopRec(); return; } // sheet closed → stop the mic
      sec++;
      txt.textContent = `Listening… ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")} — tap to finish`;
      if (sec >= MAX_SEC) stopRec();
    }, 1000);
  };
  cancel.onclick = () => { cancelled = true; stopRec(); };
  return h("div", b, cancel, hint);
}
