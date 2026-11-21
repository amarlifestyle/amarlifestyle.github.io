// Amar Lifestyle — UI helpers
import { LS } from "./api.js";

// ---------- tiny DOM builder: h("div.card", {onclick}, child, ...)
// DOM helpers that silently skip null / false (so "null" never shows up as text)
for (const P of [Element.prototype, DocumentFragment.prototype]) for (const m of ["append", "prepend", "replaceChildren", "after", "before", "replaceWith"]) {
  const o = P[m]; if (!o || o.__clean) continue;
  const f = function (...a) { return o.apply(this, a.flat(Infinity).filter(x => x != null && x !== false)); }; f.__clean = true; P[m] = f;
}
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
  wrench: `<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"/>`,
  today: `<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/> <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>`,
  week: `<path d="M8 2v3"/> <path d="M16 2v3"/> <rect x="3" y="3" width="18" height="18" rx="2"/> <path d="M3 9h18"/> <path d="M8 13h.01"/> <path d="M12 13h.01"/> <path d="M16 13h.01"/> <path d="M8 17h.01"/> <path d="M12 17h.01"/> <path d="M16 17h.01"/>`,
  money: `<rect width="20" height="12" x="2" y="6" rx="2"/> <circle cx="12" cy="12" r="2"/> <path d="M6 12h.01M18 12h.01"/>`,
  me: `<circle cx="12" cy="8" r="5"/> <path d="M20 21a8 8 0 0 0-16 0"/>`,
  more: `<circle cx="12" cy="12" r="1"/> <circle cx="19" cy="12" r="1"/> <circle cx="5" cy="12" r="1"/>`,
  plus: `<path d="M5 12h14"/> <path d="M12 5v14"/>`,
  check: `<path d="M20 6 9 17l-5-5"/>`,
  x: `<path d="M18 6 6 18"/> <path d="m6 6 12 12"/>`,
  lock: `<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/> <path d="M7 11V7a5 5 0 0 1 10 0v4"/>`,
  pin: `<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/> <circle cx="12" cy="10" r="3"/>`,
  play: `<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/>`,
  stop: `<rect width="18" height="18" x="3" y="3" rx="2"/>`,
  camera: `<path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z"/> <circle cx="12" cy="13" r="3"/>`,
  timer: `<line x1="10" x2="14" y1="2" y2="2"/> <line x1="12" x2="15" y1="14" y2="11"/> <circle cx="12" cy="14" r="8"/>`,
  routine: `<rect x="3" y="3" width="18" height="18" rx="2"/> <path d="M16 2v3"/> <path d="M3 9h18"/> <path d="M8 2v3"/> <path d="M17 13h-6"/> <path d="M13 17H7"/> <path d="M7 13h.01"/> <path d="M17 17h.01"/>`,
  cal: `<path d="M8 2v3"/> <path d="M16 2v3"/> <rect x="3" y="3" width="18" height="18" rx="2"/> <path d="M3 9h18"/>`,
  gift: `<path d="M12 7v14"/> <path d="M20 11v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8"/> <path d="M7.5 7a1 1 0 0 1 0-5A4.8 8 0 0 1 12 7a4.8 8 0 0 1 4.5-5 1 1 0 0 1 0 5"/> <rect x="3" y="7" width="18" height="4" rx="1"/>`,
  flag: `<path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528"/>`,
  student: `<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/> <path d="M22 10v6"/> <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>`,
  heart: `<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/>`,
  water: `<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>`,
  moon: `<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/>`,
  book: `<path d="M12 5v16"/> <path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z"/>`,
  report: `<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/> <path d="M14 2v5a1 1 0 0 0 1 1h5"/> <path d="M10 9H8"/> <path d="M16 13H8"/> <path d="M16 17H8"/>`,
  people: `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/> <path d="M16 3.128a4 4 0 0 1 0 7.744"/> <path d="M22 21v-2a4 4 0 0 0-3-3.87"/> <circle cx="9" cy="7" r="4"/>`,
  gear: `<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/> <circle cx="12" cy="12" r="3"/>`,
  info: `<circle cx="12" cy="12" r="10"/> <path d="M12 16v-4"/> <path d="M12 8h.01"/>`,
  goal: `<circle cx="12" cy="12" r="10"/> <circle cx="12" cy="12" r="6"/> <circle cx="12" cy="12" r="2"/>`,
  focus: `<circle cx="12" cy="12" r="10"/> <line x1="22" x2="18" y1="12" y2="12"/> <line x1="6" x2="2" y1="12" y2="12"/> <line x1="12" x2="12" y1="6" y2="2"/> <line x1="12" x2="12" y1="22" y2="18"/>`,
  download: `<path d="M12 15V3"/> <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/> <path d="m7 10 5 5 5-5"/>`,
  bell: `<path d="M10.268 21a2 2 0 0 0 3.464 0"/> <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>`,
  alerts: `<path d="M10.268 21a2 2 0 0 0 3.464 0"/> <path d="M22 8c0-2.3-.8-4.3-2-6"/> <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/> <path d="M4 2C2.8 3.7 2 5.7 2 8"/>`,
  edit: `<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/> <path d="m15 5 4 4"/>`,
  trash: `<path d="M10 11v6"/> <path d="M14 11v6"/> <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/> <path d="M3 6h18"/> <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>`,
  history: `<path d="M12 6v6l1.56.78"/> <path d="M13.227 21.925a10 10 0 1 1 8.767-9.588"/> <path d="m14 18 4-4 4 4"/> <path d="M18 22v-8"/>`,
  out: `<path d="m16 17 5-5-5-5"/> <path d="M21 12H9"/> <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>`,
  fb: '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z"/>',
  video: `<path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/> <rect x="2" y="6" width="14" height="12" rx="2"/>`,
  medal: `<path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15"/> <path d="M11 12 5.12 2.2"/> <path d="m13 12 5.88-9.8"/> <path d="M8 7h8"/> <circle cx="12" cy="17" r="5"/> <path d="M12 18v-2h-.5"/>`,
  fire: `<path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"/>`,
  coin: `<path d="M13.744 17.736a6 6 0 1 1-7.48-7.48"/> <path d="M15 6h1v4"/> <path d="m6.134 14.768.866-.5 2 3.464"/> <circle cx="16" cy="8" r="6"/>`,
  shield: `<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/> <path d="m9 12 2 2 4-4"/>`,
  habit: `<circle cx="12" cy="12" r="10"/> <path d="M4.929 4.929 19.07 19.071"/>`,
  wallet: `<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/> <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>`,
  back: `<path d="m15 18-6-6 6-6"/>`,
  chev: `<path d="m9 18 6-6-6-6"/>`,
  sun: `<circle cx="12" cy="12" r="4"/> <path d="M12 2v2"/> <path d="M12 20v2"/> <path d="m4.93 4.93 1.41 1.41"/> <path d="m17.66 17.66 1.41 1.41"/> <path d="M2 12h2"/> <path d="M20 12h2"/> <path d="m6.34 17.66-1.41 1.41"/> <path d="m19.07 4.93-1.41 1.41"/>`,
  mic: `<path d="M12 19v3"/> <path d="M19 10v2a7 7 0 0 1-14 0v-2"/> <rect x="9" y="2" width="6" height="13" rx="3"/>`,
  logo: '',
  mosque: '<path d="M12 3c2 2 4 3 4 6H8c0-3 2-4 4-6z"/><path d="M5 21V12h14v9M3 21h18M10 21v-4a2 2 0 0 1 4 0v4M5 12V9M19 12V9"/>',
  siren: `<path d="M7 18v-6a5 5 0 1 1 10 0v6"/> <path d="M5 21a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2z"/> <path d="M21 12h1"/> <path d="M18.5 4.5 18 5"/> <path d="M2 12h1"/> <path d="M12 2v1"/> <path d="m4.929 4.929.707.707"/> <path d="M12 12v6"/>`,
  copy: `<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/> <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>`,
  globe: `<circle cx="12" cy="12" r="10"/> <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/> <path d="M2 12h20"/>`,
  send: `<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/> <path d="m21.854 2.147-10.94 10.939"/>`,
  phone: `<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/> <path d="M12 18h.01"/>`,
  bulb: `<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/> <path d="M9 18h6"/> <path d="M10 22h4"/>`,
  warn: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.01"/>',
  cup: `<path d="M10 2v2"/> <path d="M14 2v2"/> <path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/> <path d="M6 2v2"/>`,
  flask: `<path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2"/> <path d="M6.453 15h11.094"/> <path d="M8.5 2h7"/>`,
  spark: `<path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/> <path d="M20 2v4"/> <path d="M22 4h-4"/> <circle cx="4" cy="20" r="2"/>`,
  chat: `<path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/>`,
  chart: `<path d="M3 3v16a2 2 0 0 0 2 2h16"/> <path d="M18 17V9"/> <path d="M13 17V5"/> <path d="M8 17v-3"/>`,
  share: `<circle cx="18" cy="5" r="3"/> <circle cx="6" cy="12" r="3"/> <circle cx="18" cy="19" r="3"/> <line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/> <line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/>`,
  receipt: `<path d="M12 17V7"/> <path d="M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8"/> <path d="M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z"/>`,
  bus: `<path d="M8 6v6"/> <path d="M15 6v6"/> <path d="M2 12h19.6"/> <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/> <circle cx="7" cy="18" r="2"/> <path d="M9 18h5"/> <circle cx="16" cy="18" r="2"/>`,
  food: `<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/> <path d="M7 2v20"/> <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>`,
  box: `<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/> <path d="M12 22V12"/> <polyline points="3.29 7 12 12 20.71 7"/> <path d="m7.5 4.27 9 5.15"/>`,
  clock: `<circle cx="12" cy="12" r="10"/> <path d="M12 6v6l4 2"/>`,
  hourglass: `<path d="M5 22h14"/> <path d="M5 2h14"/> <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/> <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>`,
  gem: `<path d="M10.5 3 8 9l4 13 4-13-2.5-6"/> <path d="M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z"/> <path d="M2 9h20"/>`,
  health: `<path d="M11 2v2"/> <path d="M5 2v2"/> <path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1"/> <path d="M8 15a6 6 0 0 0 12 0v-3"/> <circle cx="20" cy="10" r="2"/>`,
  shop: `<path d="m2.05 2.05 1.099-.028a1 1 0 0 1 1.008.815l2.69 14.347A1 1 0 0 0 7.83 18H18"/> <path d="M4.563 5h16.435a1 1 0 0 1 .981 1.204l-1.026 6.226A2 2 0 0 1 18.962 14H6.25"/> <circle cx="18" cy="20" r="2"/> <circle cx="8" cy="20" r="2"/>`,
  party: `<path d="M5.8 11.3 2 22l10.7-3.79"/> <path d="M4 3h.01"/> <path d="M22 8h.01"/> <path d="M15 2h.01"/> <path d="M22 20h.01"/> <path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/> <path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17"/> <path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7"/> <path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z"/>`,
  smoke: `<path d="M17 12H3a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h14"/> <path d="M18 8c0-2.5-2-2.5-2-5"/> <path d="M21 16a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/> <path d="M22 8c0-2.5-2-2.5-2-5"/> <path d="M7 12v4"/>`,
  user: `<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/> <circle cx="12" cy="7" r="4"/>`,
  sleep: `<path d="M2 4v16"/> <path d="M2 8h18a2 2 0 0 1 2 2v10"/> <path d="M2 17h20"/> <path d="M6 8v9"/>`,
  trophy: `<path d="M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2"/> <path d="M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2"/> <path d="M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3"/> <path d="M4 22h16"/> <path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"/> <path d="M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3"/>`,
  repeat: `<path d="m17 2 4 4-4 4"/> <path d="M3 11v-1a4 4 0 0 1 4-4h14"/> <path d="m7 22-4-4 4-4"/> <path d="M21 13v1a4 4 0 0 1-4 4H3"/>`,
  zap: `<path d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z"/>`,
  wifi: `<path d="M12 20h.01"/> <path d="M8.5 16.429a5 5 0 0 1 7 0"/> <path d="M5 12.859a10 10 0 0 1 5.17-2.69"/> <path d="M19 12.859a10 10 0 0 0-2.007-1.523"/> <path d="M2 8.82a15 15 0 0 1 4.177-2.643"/> <path d="M22 8.82a15 15 0 0 0-11.288-3.764"/> <path d="m2 2 20 20"/>`,
};

// ---------- emoji → clean line icons (one style everywhere, in the app's colour)
const EMO = {
  "✅": "check", "☑️": "check", "✔️": "check", "❌": "x", "✖️": "x", "📅": "cal", "🗓️": "cal", "📆": "cal", "📝": "edit", "✍️": "edit", "📚": "book", "📖": "book",
  "🕌": "mosque", "🚨": "siren", "⏰": "clock", "⏱️": "timer", "⏳": "hourglass", "⌛": "hourglass", "🔔": "bell", "✈️": "send", "📱": "phone", "📲": "phone",
  "💡": "bulb", "⚠️": "warn", "❗": "warn", "❓": "info", "🎯": "goal", "🍅": "timer", "☕": "cup", "🎓": "student", "🏫": "student", "🧪": "flask", "📄": "report", "📑": "report", "📋": "report",
  "📊": "chart", "📈": "chart", "📉": "chart", "🔥": "fire", "🏅": "medal", "🏆": "trophy", "💎": "gem", "💰": "wallet", "💳": "wallet", "💸": "wallet", "💵": "money", "🧾": "receipt",
  "🍽️": "food", "🍵": "cup", "🎂": "gift", "🎁": "gift", "🤝": "people", "👥": "people", "📌": "pin", "✨": "spark", "🤖": "spark", "📷": "camera", "📸": "camera", "🎙️": "mic", "🎤": "mic",
  "💬": "chat", "✉️": "chat", "🚭": "habit", "🚬": "smoke", "📤": "share", "🔐": "lock", "🔒": "lock", "👤": "user", "🙂": "user", "👨": "user", "👩": "user", "🌙": "moon", "☀️": "sun",
  "📦": "box", "🩺": "health", "🛒": "shop", "🎉": "party", "🖨️": "report", "📽️": "video", "🔁": "repeat", "↻": "repeat", "⚡": "zap", "📴": "wifi", "🏠": "today", "⬇️": "download",
  "💪": "fire", "👋": "", "😟": "chat", "🐞": "warn", "🛠️": "wrench", "🛠": "wrench", "🔧": "wrench", "📁": "box", "🗂️": "box", "📚️": "book", "🎨": "edit", "🔄": "repeat", "1️⃣": "cal", "🧩": "info", "👎": "warn", "💤": "sleep", "😴": "sleep", "💧": "water", "🚌": "bus", "🍞": "food", "🛍️": "shop", "🛍": "shop", "🎮": "party",
};
const EMO_RE = new RegExp([...Object.keys(EMO)].sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + "|\\p{Extended_Pictographic}\\uFE0F?", "gu");
const BADTXT = /(^|[\s·(:])(null|undefined|NaN)(?=$|[\s·),.])/g;
function cleanText(root) { // last safety net: never show "null" / "undefined" from empty data
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => { const p = n.parentElement; if (!p || p.closest("input,textarea,script,style")) return NodeFilter.FILTER_REJECT; BADTXT.lastIndex = 0; return BADTXT.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; } });
  const ns = []; while (w.nextNode()) ns.push(w.currentNode);
  for (const n of ns) { const v = n.nodeValue.replace(BADTXT, "$1—"); n.nodeValue = v.trim() === "—" ? "" : v; }
}
export function iconize(root) {
  if (!root || root.nodeType !== 1) return;
  cleanText(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => {
    const p = n.parentElement; if (!p || p.closest("input,textarea,select,option,script,style,.no-ico,.doc-print-keep")) return NodeFilter.FILTER_REJECT;
    for (const m of n.nodeValue.matchAll(EMO_RE)) if (!KEEP.has(m[0].replace(/\uFE0F/g, ""))) return NodeFilter.FILTER_ACCEPT; // arrows we keep never loop
    return NodeFilter.FILTER_REJECT;
  } });
  const nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
  for (const n of nodes) {
    const frag = document.createDocumentFragment(); let last = 0; const v = n.nodeValue;
    EMO_RE.lastIndex = 0;
    for (const m of v.matchAll(EMO_RE)) {
      if (m.index > last) frag.append(v.slice(last, m.index));
      const name = EMO[m[0]] ?? EMO[m[0].replace(/\uFE0F/g, "")];
      if (name) frag.append(icon(name, "ei"));
      else if (KEEP.has(m[0].replace(/\uFE0F/g, ""))) frag.append(m[0].replace(/\uFE0F/g, "")); // arrows and media signs stay as text
      last = m.index + m[0].length;
    }
    frag.append(v.slice(last).replace(/^\s+(?=\S)/, last ? " " : ""));
    n.replaceWith(frag);
  }
}
const KEEP = new Set(["↕", "⏸", "▶", "⬆", "⬇", "©", "™", "⏹", "↔", "⏭", "⏮"]);
let icoObs = null;
export function autoIconize() { // pages, sheets, toasts — everything that appears
  if (icoObs) return;
  iconize(document.body);
  icoObs = new MutationObserver(list => { for (const r of list) for (const n of r.addedNodes) { if (n.nodeType === 1) iconize(n); else if (n.nodeType === 3 && n.parentElement) iconize(n.parentElement); } });
  icoObs.observe(document.body, { childList: true, subtree: true });
}
export function icon(name, cls = "") {
  if (name === "logo") return logoSvg();
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("fill", "none"); s.setAttribute("stroke", "currentColor");
  s.setAttribute("stroke-width", "1.75"); s.setAttribute("stroke-linecap", "round"); s.setAttribute("stroke-linejoin", "round");
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

// choose a photo: take one now with the camera, or pick one from the gallery
export function pickPhoto(title = "ছবি দিন") {
  return new Promise(resolve => {
    let done = false, closeMe = null;
    const fin = f => { if (!done) { done = true; resolve(f || null); } };
    const make = cam => {
      const i = h("input", { type: "file", accept: "image/*", style: { position: "fixed", left: "-9999px", top: "0", opacity: "0" } });
      if (cam) i.setAttribute("capture", "environment");
      i.onchange = () => { fin(i.files && i.files[0]); i.remove(); };
      i.addEventListener("cancel", () => { fin(null); i.remove(); });
      document.body.append(i);
      return i;
    };
    // the phone only opens the camera / gallery if it happens inside the tap itself — so click the input right away,
    // and close only this small sheet (never the AI window under it)
    const opt = (ic, label, sub, cam) => {
      const b = h("button.li", { type: "button", style: { textAlign: "left" } }, h("div.ic", ic), h("div.grow", h("b", label), h("div.small.muted", sub)));
      b.onclick = () => { const i = make(cam); i.click(); closeMe?.(undefined); };
      return b;
    };
    sheet(title, [h("div.list", opt("📷", "Camera", "এখনই ছবি তুলুন", true), opt("🖼️", "Gallery", "আগে তোলা ছবি থেকে বেছে নিন", false))],
      { actions: close => { closeMe = close; return [h("button.btn", { onclick: () => { close(null); fin(null); } }, "Cancel")]; } });
  });
}

// a short alert sound while the app is open (phones play their own sound for notifications when it's closed)
let actx = null;
const unlockAudio = () => { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === "suspended") actx.resume(); } catch {} };
addEventListener("pointerdown", unlockAudio, { once: true, capture: true });
export function chime(level = "normal") {
  try {
    unlockAudio(); if (!actx) return;
    const notes = level === "urgent" ? [880, 1175, 1568, 0, 880, 1175, 1568] : [784, 1047];
    let t = actx.currentTime + 0.02;
    for (const f of notes) {
      if (f) {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = "triangle"; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        o.connect(g).connect(actx.destination); o.start(t); o.stop(t + 0.25);
      }
      t += 0.14;
    }
    if (level === "urgent") navigator.vibrate?.([300, 120, 300]);
  } catch { /* no sound on this device */ }
}

// swipe a row to the left to send it away (with a red "remove" strip behind)
export function swipeAway(el, onGone) {
  let x0 = null, y0 = 0, dx = 0, lock = null;
  el.style.touchAction = "pan-y";
  el.addEventListener("pointerdown", e => { if (e.button) return; x0 = e.clientX; y0 = e.clientY; dx = 0; lock = null; });
  el.addEventListener("pointermove", e => {
    if (x0 === null) return;
    const mx = e.clientX - x0, my = e.clientY - y0;
    if (lock === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) lock = Math.abs(mx) > Math.abs(my) ? "x" : "y";
    if (lock !== "x") return;
    dx = Math.min(0, mx); el.style.transition = "none"; el.style.transform = `translateX(${dx}px)`; el.style.opacity = String(1 + dx / 400);
    el.classList.add("swiping");
  });
  const end = () => {
    if (x0 === null) return; x0 = null;
    el.style.transition = "transform .28s cubic-bezier(.22,1,.36,1), opacity .28s, max-height .3s .2s, padding .3s .2s";
    if (lock === "x" && dx < -90) {
      el.dataset.swiped = "1";
      el.style.transform = "translateX(-110%)"; el.style.opacity = "0";
      el.style.maxHeight = el.offsetHeight + "px"; requestAnimationFrame(() => { el.style.maxHeight = "0"; el.style.paddingTop = "0"; el.style.paddingBottom = "0"; });
      setTimeout(() => { el.remove(); onGone?.(); }, 520);
    } else { el.style.transform = ""; el.style.opacity = ""; setTimeout(() => el.classList.remove("swiping"), 300); if (lock === "x") { el.dataset.swiped = "1"; setTimeout(() => delete el.dataset.swiped, 50); } }
    lock = null;
  };
  el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
}

// copyright line shown at the bottom of public pages, More and About
export const COPYRIGHT = "© 2026 Musfiqur Rahman. All rights reserved. Unauthorized copying is prohibited.";
export function copyright() { return h("footer.copy", COPYRIGHT); }

// ---------- a month calendar (Saturday first) for attendance-like views
// day(ds) → null | { dots: ["#color", …], sub: "1h", has: true }; summary(month) → small line under the title; onTap(ds)
export function monthCalendar({ month, day, summary, onTap, legend = [] }) {
  const box = h("div.card.cal.mcal");
  const today = todayStr();
  const draw = m => {
    const y = +m.slice(0, 4), mo = +m.slice(5, 7), days = new Date(Date.UTC(y, mo, 0)).getUTCDate(), lead = (new Date(Date.UTC(y, mo - 1, 1)).getUTCDay() + 1) % 7;
    const shift = n => { const d = new Date(Date.UTC(y, mo - 1 + n, 1)); draw(d.toISOString().slice(0, 10)); };
    const cells = [...Array(lead)].map(() => h("div.cal-c.blank"));
    for (let d = 1; d <= days; d++) {
      const ds = `${m.slice(0, 8)}${String(d).padStart(2, "0")}`, info = day(ds);
      const c = h("button.cal-c" + (ds === today ? ".today" : "") + (info?.has ? ".has" : "") + (ds > today ? ".future" : ""), { type: "button", "aria-label": ds },
        h("span.cal-n", String(d)),
        info?.dots?.length ? h("span.mcal-dots", info.dots.slice(0, 6).map(col => h("i", { style: { background: col } }))) : null,
        info?.sub ? h("span.mcal-sub", info.sub) : null);
      if (info?.has && onTap) c.onclick = () => onTap(ds);
      cells.push(c);
    }
    const name = new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
    box.replaceChildren(
      h("div.row.between", { style: { marginBottom: "8px" } },
        h("button.icon-btn", { type: "button", "aria-label": "Previous month", onclick: () => shift(-1) }, icon("back")),
        h("div.center", h("b", name), summary ? h("div.small.muted", summary(m)) : null),
        h("button.icon-btn", { type: "button", "aria-label": "Next month", onclick: () => shift(1) }, icon("chev"))),
      h("div.cal-grid.cal-head", ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"].map(x => h("span", x))),
      h("div.cal-grid", cells),
      legend.length ? h("div.cal-legend", legend.map(([l, col]) => h("span", h("i", { style: { background: col } }), l))) : null);
  };
  draw((month || today).slice(0, 8) + "01");
  return box;
}
