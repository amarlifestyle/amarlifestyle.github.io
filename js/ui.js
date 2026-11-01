// Amar Lifestyle — UI helpers
import { LS } from "./api.js";

// ---------- tiny DOM builder: h("div.card", {onclick}, child, ...)
export function h(sel, props, ...kids) {
  if (props == null || typeof props !== "object" || props instanceof Node || Array.isArray(props)) { if (props != null && props !== false) kids.unshift(props); props = {}; }
  const [tag, ...cls] = sel.split(".");
  const el = document.createElement(tag || "div");
  if (cls.length) el.className = cls.join(" ");
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "style" && typeof v === "object") { for (const [sk, sv] of Object.entries(v)) { if (sv == null) continue; if (sk.startsWith("--")) el.style.setProperty(sk, sv); else el.style[sk] = sv; } }
    else if (k === "html") el.innerHTML = v;
    else if (k in el && k !== "list" && typeof v !== "string") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  add(el, kids);
  return el;
}
function add(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

// ---------- icons (stroke SVG)
const P = {
  today: '<path d="M4 7h16M4 7v12a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V7M4 7l1-3h14l1 3"/><path d="m9 14 2 2 4-4"/>',
  week: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M8 13h2M14 13h2M8 17h2"/>',
  money: '<rect x="2" y="6" width="20" height="13" rx="2"/><circle cx="12" cy="12.5" r="2.5"/><path d="M6 10v.01M18 15v.01"/>',
  me: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  pin: '<path d="M12 17v5M8 3h8l-1 6 3 4H6l3-4z"/>',
  play: '<path d="M7 5v14l11-7z"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>',
  routine: '<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3"/><path d="M18 3v4h-4M6 21v-4h4"/>',
  cal: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
  gift: '<rect x="3" y="9" width="18" height="12" rx="1"/><path d="M3 13h18M12 9v12M12 9S10 4 7.5 5 9 9 12 9zM12 9s2-5 4.5-4S15 9 12 9z"/>',
  flag: '<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>',
  student: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>',
  heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
  water: '<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/>',
  moon: '<path d="M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>',
  report: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.5c2.5 0 4.5 1.5 5.5 4.5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
  goal: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  focus: '<circle cx="12" cy="12" r="3"/><path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  out: '<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>',
  fb: '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
  medal: '<circle cx="12" cy="15" r="6"/><path d="M8 3h8l-2 6h-4z"/>',
  fire: '<path d="M12 3s5 4 5 9a5 5 0 0 1-10 0c0-2 1-3 1-3s1 2 2 2c0-4 2-8 2-8z"/>',
  coin: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M9.5 10.5c0-1 1-1.5 2.5-1.5s2.5.5 2.5 1.5-1 1.5-2.5 1.5-2.5.5-2.5 1.5 1 1.5 2.5 1.5 2.5-.5 2.5-1.5"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
  habit: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
  wallet: '<path d="M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 7l12-4v4M16 13.5h.01"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  logo: '',
};
export function icon(name, cls = "") {
  if (name === "logo") return logoSvg();
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("fill", "none"); s.setAttribute("stroke", "currentColor");
  s.setAttribute("stroke-width", "1.8"); s.setAttribute("stroke-linecap", "round"); s.setAttribute("stroke-linejoin", "round");
  s.setAttribute("aria-hidden", "true"); if (cls) s.setAttribute("class", cls);
  s.setAttribute("width", "20"); s.setAttribute("height", "20"); s.style.flexShrink = "0"; // some phones show nothing without a size
  s.innerHTML = P[name] || P.info;
  return s;
}
let gid = 0;
export function logoSvg(size = 28) {
  const id = "lg" + (++gid);
  const w = document.createElement("span");
  w.innerHTML = `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#22D3EE"/><stop offset="1" stop-color="#4ADE80"/></linearGradient></defs><path d="M16 84 L38 22 L60 84 L86 84" fill="none" stroke="url(#${id})" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><circle cx="38" cy="9" r="6" fill="#FBBF24"/></svg>`;
  return w.firstChild;
}

// ---------- language (English default, Bangla option)
const BN = {
  "Today": "আজ", "Week": "সপ্তাহ", "Money": "টাকা", "Me": "আমি", "More": "আরও",
  "Completed": "সম্পন্ন", "Not Completed": "হয়নি", "Add task": "টাস্ক যোগ", "Start timer": "টাইমার চালু",
  "Save": "সেভ", "Cancel": "বাতিল", "Delete": "মুছুন", "Income": "আয়", "Expense": "খরচ", "Budget": "বাজেট",
  "Savings": "সেভিংস", "Routine": "রুটিন", "Calendar": "ক্যালেন্ডার", "Settings": "সেটিংস", "About Us": "আমাদের সম্পর্কে",
  "Log in": "লগইন", "Create account": "নতুন অ্যাকাউন্ট", "Phone number": "ফোন নাম্বার", "Password": "পাসওয়ার্ড",
  "Tasks done": "টাস্ক ডান", "Streak": "স্ট্রিক", "Coins": "কয়েন", "Level": "লেভেল", "Reports": "রিপোর্ট",
  "Tuition": "টিউশন", "Life": "জীবন", "Goals": "লক্ষ্য", "People": "মানুষ", "Locked": "লক",
};
export function t(s) { return (LS.get("al_lang", "en") === "bn" && BN[s]) || s; }

// ---------- feedback
export function toast(msg, kind = "") {
  let box = document.getElementById("toast");
  if (!box) { box = h("div", { id: "toast", role: "status", "aria-live": "polite" }); document.body.appendChild(box); }
  const el = h("div.toast" + (kind ? "." + kind : ""), msg);
  box.appendChild(el);
  setTimeout(() => { el.style.transition = "opacity .3s"; el.style.opacity = "0"; setTimeout(() => el.remove(), 320); }, kind === "bad" ? 4200 : 2600);
}

export function sheet(title, body, { actions, hint } = {}) {
  return new Promise(resolve => {
    let done = false;
    const close = v => {
      if (done) return; done = true;
      document.removeEventListener("keydown", esc); resolve(v);
      bd.className = "backdrop-out"; setTimeout(() => bd.remove(), 200); // slide down, then remove
    };
    const esc = e => { if (e.key === "Escape") close(null); };
    const box = h("div.sheet", { role: "dialog", "aria-modal": "true", "aria-label": title },
      h("div.grab"), h("h2", title), hint ? h("p.hint", hint) : null,
      typeof body === "function" ? body(close) : body,
      actions ? h("div.actions", actions(close)) : null);
    const bd = h("div.backdrop", { onclick: e => { if (e.target === bd) close(null); } }, box);
    document.body.appendChild(bd);
    document.addEventListener("keydown", esc);
    // drag the handle down to close
    const grab = box.querySelector(".grab");
    let y0 = null, dy = 0;
    grab.addEventListener("pointerdown", e => { y0 = e.clientY; dy = 0; grab.setPointerCapture(e.pointerId); box.style.transition = "none"; });
    grab.addEventListener("pointermove", e => { if (y0 === null) return; dy = Math.max(0, e.clientY - y0); box.style.transform = `translateY(${dy}px)`; });
    const end = () => { if (y0 === null) return; y0 = null; box.style.transition = ""; if (dy > 90) close(null); else box.style.transform = ""; };
    grab.addEventListener("pointerup", end); grab.addEventListener("pointercancel", end);
    setTimeout(() => box.querySelector("input,select,textarea")?.focus(), 250);
  });
}

export function confirmBox(title, text, okLabel = "Yes", danger = false) {
  return sheet(title, h("p.muted", text), {
    actions: close => [h("button.btn", { onclick: () => close(false) }, "Cancel"),
      h("button.btn" + (danger ? ".danger" : ".primary"), { onclick: () => close(true) }, okLabel)],
  });
}

export function askPin(reason = "Enter your 4-digit PIN") {
  const inp = h("input.input", { type: "password", inputmode: "numeric", maxlength: "4", autocomplete: "off", placeholder: "••••", style: { fontSize: "26px", letterSpacing: "12px", textAlign: "center" }, "aria-label": "PIN" });
  return sheet("PIN", [h("p.hint", reason), inp], {
    actions: close => {
      inp.addEventListener("keydown", e => { if (e.key === "Enter" && inp.value.length === 4) close(inp.value); });
      return [h("button.btn", { onclick: () => close(null) }, "Cancel"),
        h("button.btn.primary", { onclick: () => inp.value.length === 4 ? close(inp.value) : toast("PIN must be 4 digits", "bad") }, "OK")];
    },
  });
}

export function busy(btn, fn) {
  return async (...a) => {
    if (btn.disabled) return;
    btn.disabled = true;
    try { return await fn(...a); } catch (e) { toast(e.message || String(e), "bad"); } finally { btn.disabled = false; }
  };
}

// ---------- formatting
export const tk = n => "৳" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
export const pad = n => String(n).padStart(2, "0");
export function dhakaNow() { return new Date(Date.now() + (6 * 60 + new Date().getTimezoneOffset()) * 60000); }
export function todayStr() { const d = dhakaNow(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function dateStr(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function addDays(s, n) { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() + n); return dateStr(d); }
export function fmtTime(iso) {
  const d = new Date(new Date(iso).getTime() + (6 * 60 + new Date().getTimezoneOffset()) * 60000);
  let hh = d.getHours(); const ap = hh >= 12 ? "PM" : "AM"; hh = hh % 12 || 12;
  return `${hh}:${pad(d.getMinutes())} ${ap}`;
}
export function fmtHM(t) { const [H, M] = t.split(":").map(Number); const ap = H >= 12 ? "PM" : "AM"; return `${H % 12 || 12}:${pad(M)} ${ap}`; }
export function fmtDate(s, opt = { day: "numeric", month: "short" }) { return new Date(s + "T00:00:00").toLocaleDateString("en-GB", opt); }
export function mins(a, b) { return Math.round((new Date(b) - new Date(a)) / 60000); }
export function durLabel(m) { const H = Math.floor(m / 60), M = m % 60; return H ? (M ? `${H}h ${M}m` : `${H}h`) : `${M}m`; }
export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function dhakaIso(day, hhmm) { return new Date(`${day}T${hhmm}:00+06:00`).toISOString(); }

// ---------- charts (plain SVG)
export function barChart(items, { height = 150, color = "var(--brand)", fmt = v => v } = {}) {
  const max = Math.max(1, ...items.map(i => Math.abs(i.v)));
  const w = 320, bw = w / items.length, base = height - 22;
  const bars = items.map((it, i) => {
    const bh = Math.max(it.v ? 2 : 0, Math.abs(it.v) / max * (base - 14));
    const y = it.v >= 0 ? base - bh : base;
    return `<rect x="${i * bw + bw * 0.18}" y="${y}" width="${bw * 0.64}" height="${bh}" rx="3" fill="${it.v < 0 ? "var(--red)" : (it.c || color)}"><title>${it.l}: ${fmt(it.v)}</title></rect>` +
      (it.l && (items.length <= 12 || i % Math.ceil(items.length / 8) === 0) ? `<text x="${i * bw + bw / 2}" y="${height - 6}" font-size="9" text-anchor="middle" fill="var(--faint)">${it.l}</text>` : "");
  }).join("");
  return h("div.chart", { html: `<svg viewBox="0 0 ${w} ${height}" role="img" aria-label="Bar chart"><line x1="0" x2="${w}" y1="${base}" y2="${base}" stroke="var(--line2)"/>${bars}</svg>` });
}
export function donut(parts, { size = 150, center = "" } = {}) {
  const total = parts.reduce((s, p) => s + p.v, 0) || 1;
  let a = -Math.PI / 2; const r = 52, cx = 75, cy = 75;
  const segs = parts.filter(p => p.v > 0).map(p => {
    const ang = p.v / total * Math.PI * 2, a2 = a + ang;
    const large = ang > Math.PI ? 1 : 0;
    const d = ang >= Math.PI * 2 - 0.001
      ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r}`
      : `M ${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)} A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(a2)} ${cy + r * Math.sin(a2)}`;
    a = a2;
    return `<path d="${d}" fill="none" stroke="${p.c}" stroke-width="18"><title>${p.l}: ${p.v}</title></path>`;
  }).join("");
  const svg = `<svg viewBox="0 0 150 150" width="${size}" height="${size}" role="img" aria-label="Pie chart"><circle cx="75" cy="75" r="52" fill="none" stroke="var(--bg2)" stroke-width="18"/>${segs}<text x="75" y="80" text-anchor="middle" font-size="15" font-weight="700" fill="var(--text)">${center}</text></svg>`;
  return h("div.row", { style: { gap: "16px", alignItems: "center" } },
    h("div", { html: svg }),
    h("div.grow", parts.map(p => h("div.row.between.small", { style: { padding: "3px 0" } },
      h("span", h("i", { style: { display: "inline-block", width: "10px", height: "10px", borderRadius: "3px", background: p.c, marginRight: "6px" } }), p.l),
      h("b", p.fmt || p.v)))));
}
export function ring(pct, label, sub) {
  const r = 40, c = 2 * Math.PI * r, off = c * (1 - Math.min(1, Math.max(0, pct)));
  return h("div.ring", { html: `<svg viewBox="0 0 96 96"><defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22D3EE"/><stop offset="1" stop-color="#4ADE80"/></linearGradient></defs><circle cx="48" cy="48" r="${r}" fill="none" stroke="var(--bg2)" stroke-width="9"/><circle cx="48" cy="48" r="${r}" fill="none" stroke="url(#rg)" stroke-width="9" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}" style="transition:stroke-dashoffset .8s ease"/></svg><div class="lbl"><b>${label}</b><span>${sub}</span></div>` });
}
export const PALETTE = ["#22D3EE", "#4ADE80", "#FBBF24", "#E879F9", "#60A5FA", "#F87171", "#A78BFA", "#2DD4BF",
  "#FB923C", "#F472B6", "#A3E635", "#38BDF8", "#FACC15", "#C084FC", "#34D399", "#FDA4AF",
  "#818CF8", "#FCA5A5", "#5EEAD4", "#FDE047", "#F0ABFC", "#93C5FD", "#86EFAC", "#94A3B8"];
// colour chooser: 24 neon swatches + any custom colour
export function colorPicker(current, onPick, { allowNone = false } = {}) {
  let cur = current || "";
  const box = h("div.colors");
  const mark = el => box.querySelectorAll("button,label").forEach(b => b.classList.toggle("on", b === el));
  if (allowNone) box.append(h("button" + (!cur ? ".on" : ""), { type: "button", title: "Automatic", "aria-label": "Automatic colour", style: { background: "conic-gradient(#22D3EE,#4ADE80,#FBBF24,#E879F9,#22D3EE)" }, onclick: e => { cur = ""; mark(e.currentTarget); onPick(""); } }));
  PALETTE.forEach(c => box.append(h("button" + (c.toLowerCase() === cur.toLowerCase() ? ".on" : ""), { type: "button", "aria-label": c, style: { background: c }, onclick: e => { cur = c; mark(e.currentTarget); onPick(c); } })));
  const custom = h("input", { type: "color", value: cur && !PALETTE.includes(cur) ? cur : "#ffffff", "aria-label": "Custom colour", style: { position: "absolute", opacity: 0, width: "100%", height: "100%", inset: 0, cursor: "pointer" } });
  const lab = h("label" + (cur && !PALETTE.map(x => x.toLowerCase()).includes(cur.toLowerCase()) ? ".on" : ""), { title: "Any colour", style: { position: "relative", width: "34px", height: "34px", borderRadius: "50%", border: "2px dashed var(--line2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", color: "var(--muted)", cursor: "pointer" } }, "+", custom);
  custom.oninput = () => { cur = custom.value; lab.style.background = cur; mark(lab); onPick(cur); };
  box.append(lab);
  return box;
}

// colours for routine items: the same name always gets the same colour, a new name gets one nobody else uses
export const DISTINCT = ["#3B82F6", "#22C55E", "#FB923C", "#E879F9", "#22D3EE", "#FACC15", "#A78BFA", "#F87171", "#2DD4BF", "#F472B6", "#A3E635", "#818CF8", "#FDE047", "#5EEAD4", "#FCA5A5", "#E5E7EB"];
export function pickColor(title, known = []) {
  const n = x => String(x || "").toLowerCase().replace(/[.\s]/g, "");
  const same = known.find(r => r.color && n(r.title) === n(title));
  if (same) return same.color;
  // coaching codes (C.P, C.B, CH, CS, CCP, CCB, CSP, CSB …) all share the coaching colour
  const coach = x => /^c(c|s|h)?(p|b|c|m)?$/.test(n(x)) && n(x).length >= 2;
  if (coach(title)) { const g = known.find(r => r.color && coach(r.title)); if (g) return g.color; }
  const used = new Set(known.filter(r => r.color).map(r => r.color.toUpperCase()));
  return DISTINCT.find(c => !used.has(c.toUpperCase())) || DISTINCT[Math.floor(Math.random() * DISTINCT.length)];
}

// tap a shortened help line to read all of it
document.addEventListener("click", e => { const x = e.target.closest?.(".hint"); if (x && !e.target.closest("a,button,input,select,textarea")) x.classList.toggle("open"); });
