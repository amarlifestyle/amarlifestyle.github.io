// Amar Lifestyle — pick a time: "from – to" or "start + how long". Starts at the phone's current time.
import { h, pad, durLabel } from "./ui.js";

const toMin = t => { const [a, b] = String(t || "0:0").split(":").map(Number); return a * 60 + b; };
const toHM = m => { m = ((m % 1440) + 1440) % 1440; return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; };
export function nowHM(step = 5) { // phone time, rounded up to the next 5 minutes (Dhaka)
  const d = new Date(Date.now() + (6 * 60 + new Date().getTimezoneOffset()) * 60000);
  return toHM(Math.ceil((d.getHours() * 60 + d.getMinutes()) / step) * step);
}
const DURS = [15, 30, 45, 60, 75, 90, 120, 180];

export function timePicker({ start = nowHM(), minutes = 60 } = {}) {
  let mode = "range", dur = minutes;
  const s = h("input.input.tp-in", { type: "time", value: start, "aria-label": "Start" });
  const e = h("input.input.tp-in", { type: "time", value: toHM(toMin(start) + minutes), "aria-label": "End" });
  const custom = h("input.input.tp-in", { type: "number", min: "5", max: "720", inputmode: "numeric", value: minutes, "aria-label": "Minutes" });
  const info = h("div.tp-info");
  const chips = h("div.tp-chips");
  const drawChips = () => chips.replaceChildren(...DURS.map(m => h("button.chip" + (m === dur ? ".on" : ""), { type: "button", onclick: () => { dur = m; custom.value = m; e.value = toHM(toMin(s.value) + m); drawChips(); show(); } }, durLabel(m))));
  const show = () => {
    const m = len();
    info.textContent = m >= 5 ? `${fmt(s.value)} → ${fmt(toHM(toMin(s.value) + m))} · ${durLabel(m)}` : "End must be after start";
    info.classList.toggle("bad", !(m >= 5 && m <= 720));
  };
  const fmt = t => { const [H, M] = t.split(":").map(Number); return `${H % 12 || 12}:${pad(M)} ${H >= 12 ? "PM" : "AM"}`; };
  const len = () => mode === "range" ? ((toMin(e.value) - toMin(s.value)) + 1440) % 1440 : Number(custom.value) || 0;
  s.oninput = () => { if (mode === "range") e.value = toHM(toMin(s.value) + dur); show(); };
  e.oninput = () => { dur = len(); drawChips(); show(); };
  custom.oninput = () => { dur = Number(custom.value) || 0; drawChips(); show(); };
  const rangeBox = h("div.tp-grid", h("label.f.mb0", h("span", "Start"), s), h("span.tp-arrow", "→"), h("label.f.mb0", h("span", "End"), e));
  const durBox = h("div", h("label.f.mb0", h("span", "Start"), s.cloneNode()), chips, h("label.f.mb0", { style: { marginTop: "8px" } }, h("span", "Or minutes"), custom));
  // one start field is shared: keep the copy in sync
  const s2 = durBox.querySelector("input[type=time]"); s2.value = s.value;
  s2.oninput = () => { s.value = s2.value; show(); };
  const body = h("div");
  const seg = h("div.seg.tp-seg", [["range", "From – to"], ["dur", "Duration"]].map(([k, l]) => h("button" + (k === mode ? ".on" : ""), { type: "button", "data-k": k, onclick: () => setMode(k) }, l)));
  const setMode = k => {
    if (k === "dur") { custom.value = len() || dur; dur = Number(custom.value); s2.value = s.value; drawChips(); }
    else { e.value = toHM(toMin(s.value) + (Number(custom.value) || dur)); }
    mode = k; seg.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.k === k));
    body.replaceChildren(k === "range" ? rangeBox : durBox); show();
  };
  setMode("range"); drawChips();
  return {
    el: h("div.tp", seg, body, info),
    get: () => ({ start: s.value, minutes: len() }),
  };
}
