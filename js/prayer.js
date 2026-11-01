// Amar Lifestyle — prayer (namaz) times for Muslim users: calculated on the phone, no internet needed.
// Method: University of Islamic Sciences, Karachi (Fajr & Isha 18°), Asr Hanafi — the method Islamic Foundation Bangladesh uses.
import * as api from "./api.js";
import { h, toast, sheet, busy, todayStr, addDays, fmtHM, barChart } from "./ui.js";
import { route, store, rerender, loadBasics } from "./app.js";

export const RELIGIONS = {
  muslim: "☪️ Muslim · মুসলিম", hindu: "🕉️ Hindu · হিন্দু", buddhist: "☸️ Buddhist · বৌদ্ধ", christian: "✝️ Christian · খ্রিস্টান", other: "Other / বলতে চাই না",
};
export const isMuslim = () => store.profile?.religion === "muslim";
export function religionPicker(current, onPick) {
  const box = h("div.row.wrap", { style: { gap: "6px" } });
  const draw = cur => box.replaceChildren(...Object.entries(RELIGIONS).map(([k, l]) =>
    h("button.btn.small" + (k === cur ? ".primary" : ""), { type: "button", onclick: () => { draw(k); onPick(k); } }, l)));
  draw(current);
  return box;
}
export async function saveReligion(k) {
  await api.update("profiles", `id=eq.${store.profile.id}`, { religion: k });
  store.profile.religion = k;
  api.LS.set("al_basics", { ...(api.LS.get("al_basics") || {}), profile: store.profile });
}

export const PRAYERS = [
  ["fajr", "Fajr", "ফজর"], ["dhuhr", "Dhuhr", "যোহর"], ["asr", "Asr", "আসর"], ["maghrib", "Maghrib", "মাগরিব"], ["isha", "Isha", "এশা"],
];
const BN = Object.fromEntries(PRAYERS.map(p => [p[0], p[2]]));
const DHAKA = { lat: 23.8103, lng: 90.4125, name: "Dhaka" };
export const place = () => store.profile?.prayer_loc?.lat ? store.profile.prayer_loc : DHAKA;

// ---- sun maths (praytimes.org formulas)
const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
const fix = (a, b) => { a = a - b * Math.floor(a / b); return a < 0 ? a + b : a; };
function sun(jd) {
  const D = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * D, 360), q = fix(280.459 + 0.98564736 * D, 360);
  const L = fix(q + 1.915 * Math.sin(rad(g)) + 0.020 * Math.sin(rad(2 * g)), 360);
  const e = 23.439 - 0.00000036 * D;
  const RA = fix(deg(Math.atan2(Math.cos(rad(e)) * Math.sin(rad(L)), Math.cos(rad(L)))) / 15, 24);
  return { decl: deg(Math.asin(Math.sin(rad(e)) * Math.sin(rad(L)))), eqt: q / 15 - RA };
}
// times for one date (yyyy-mm-dd) → { fajr, sunrise, dhuhr, asr, maghrib, isha } as Date objects
export function timesFor(day, loc = place()) {
  const [y, m, d] = day.split("-").map(Number);
  let Y = y, M = m; if (M <= 2) { Y -= 1; M += 12; }
  const A = Math.floor(Y / 100), B = 2 - A + Math.floor(A / 4);
  const jd0 = Math.floor(365.25 * (Y + 4716)) + Math.floor(30.6001 * (M + 1)) + d + B - 1524.5 - loc.lng / 360;
  const lat = loc.lat;
  const noon = t => fix(12 - sun(jd0 + t / 24).eqt, 24);
  const angleTime = (angle, t, before) => {
    const { decl } = sun(jd0 + t / 24);
    const T = deg(Math.acos((-Math.sin(rad(angle)) - Math.sin(rad(decl)) * Math.sin(rad(lat))) / (Math.cos(rad(decl)) * Math.cos(rad(lat))))) / 15;
    return noon(t) + (before ? -T : T);
  };
  const asrTime = t => { const { decl } = sun(jd0 + t / 24); const a = -deg(Math.atan(1 / (2 + Math.tan(rad(Math.abs(lat - decl)))))); return angleTime(a, t, false); };
  let t = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, maghrib: 18, isha: 18 };
  for (let i = 0; i < 2; i++) t = {
    fajr: angleTime(18, t.fajr, true), sunrise: angleTime(0.833, t.sunrise, true), dhuhr: noon(t.dhuhr),
    asr: asrTime(t.asr), maghrib: angleTime(0.833, t.maghrib, false), isha: angleTime(18, t.isha, false),
  };
  const extra = { dhuhr: 2, maghrib: 2 }; // small safety minutes, like local tables
  const out = {};
  for (const [k, v] of Object.entries(t)) {
    const local = v + 6 - loc.lng / 15; // hours in Dhaka time (UTC+6)
    const mins = Math.round(local * 60) + (extra[k] || 0);
    out[k] = new Date(Date.UTC(y, m - 1, d, 0, mins) - 6 * 3600e3);
  }
  return out;
}
// each waqt: when it starts and ends
export function waqts(day) {
  const t = timesFor(day), nf = timesFor(addDays(day, 1)).fajr;
  return [
    { key: "fajr", start: t.fajr, end: t.sunrise }, { key: "dhuhr", start: t.dhuhr, end: t.asr }, { key: "asr", start: t.asr, end: t.maghrib },
    { key: "maghrib", start: t.maghrib, end: t.isha }, { key: "isha", start: t.isha, end: nf },
  ].map(w => ({ ...w, bn: BN[w.key], en: PRAYERS.find(p => p[0] === w.key)[1] }));
}
const tm = d => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" });
const left = ms => { const m = Math.max(0, Math.round(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; };

export async function prayedOn(from, to) {
  try { return await api.select("prayer_logs", `select=day,prayer&day=gte.${from}&day=lte.${to}`); } catch { return []; }
}
async function toggle(day, key, on) {
  if (on) await api.insert("prayer_logs", { user_id: api.userId(), day, prayer: key });
  else await api.remove("prayer_logs", `day=eq.${day}&prayer=eq.${key}`);
}
function tickBtn(day, w, done, after) {
  const b = h("button.btn.small" + (done ? ".primary" : ""), { type: "button" }, done ? "✓ পড়েছি" : "পড়েছি?");
  b.onclick = busy(b, async e => { e?.stopPropagation?.(); await toggle(day, w.key, !done); if (!done) toast(`${w.bn} ✓ আলহামদুলিল্লাহ`, "ok"); after(); });
  return b;
}

// rows for the Today list (sorted together with tasks by start time)
export async function prayerItems(day) {
  if (!isMuslim()) return [];
  const done = new Set((await prayedOn(day, day)).map(r => r.prayer));
  return waqts(day).map(w => ({ isPrayer: true, id: "pr:" + w.key, day, w, done: done.has(w.key), start_at: w.start.toISOString(), end_at: w.end.toISOString() }));
}
export function prayerRow(p) {
  const now = Date.now(), live = now >= p.w.start && now < p.w.end, past = now >= p.w.end, future = now < p.w.start;
  const c = "#10B981";
  return h("div.task" + (p.done ? ".done" : ""), { style: { "--c": c, padding: "8px 12px", ...(live && !p.done ? { borderColor: c, background: `color-mix(in srgb, ${c} 10%, var(--card))` } : {}) } },
    h("div.row.between", { style: { gap: "8px", alignItems: "center" } },
      h("div.grow", { style: { minWidth: 0 } },
        h("div", h("b", "🕌 ", p.w.bn), h("span.small.muted", ` · ${tm(p.w.start)} – ${tm(p.w.end)}`)),
        h("div.small", { style: { color: live ? c : "var(--faint)" } }, p.done ? "পড়া হয়েছে" : live ? `এখন ${p.w.bn}ের ওয়াক্ত · ${left(p.w.end - now)} বাকি` : past ? "ওয়াক্ত শেষ" : `ওয়াক্ত শুরু ${left(p.w.start - now)} পর`)),
      future ? null : tickBtn(p.day, p.w, p.done, rerender)));
}
// one line for the night report
export async function prayerCount(day) {
  if (!isMuslim()) return null;
  return (await prayedOn(day, day)).length;
}

// ---------- Routine → 🕌 Prayer tab
route("prayer", async page => {
  const { routineTabsAsync } = await import("./timetable.js");
  page.append(h("header.topbar", h("div", h("h1", "Routine"), h("div.sub", "নামাজের সময় · " + place().name))), await routineTabsAsync("prayer"));
  if (!isMuslim()) {
    page.append(h("div.card", h("p", "এই অংশ মুসলিমদের জন্য। Settings → Profile থেকে ধর্ম বেছে নিন।")));
    return;
  }
  const today = todayStr(), yday = addDays(today, -1);
  const from = addDays(today, -183);
  const logs = await prayedOn(from, today);
  const set = new Set(logs.map(r => r.day + ":" + r.prayer));
  const W = waqts(today), now = Date.now();
  const cur = W.find(w => now >= w.start && now < w.end) || (now < W[0].start ? { ...waqts(yday)[4] } : null);
  const next = W.find(w => w.start > now) || waqts(addDays(today, 1))[0];
  const todayN = W.filter(w => set.has(today + ":" + w.key)).length;

  page.append(h("div.hero", { style: { flexDirection: "column", alignItems: "stretch", gap: "4px" } },
    cur ? h("div", h("span.small.muted", "এখন ওয়াক্ত চলছে"), h("div.big", "🕌 ", cur.bn), h("div.small.muted", `শেষ ${tm(cur.end)} · ${left(cur.end - now)} বাকি`)) : h("div.big", "🕌 এখন কোনো ফরজ নামাজের ওয়াক্ত নেই"),
    h("div.small", "পরের নামাজ: ", h("b", next.bn), ` ${tm(next.start)} (${left(next.start - now)} পর)`),
    h("div.small", "আজ পড়েছি: ", h("b", `${todayN}/5`), " ওয়াক্ত")));

  const listFor = (day, ws) => h("div.list", ws.map(w => {
    const done = set.has(day + ":" + w.key), started = Date.now() >= w.start, live = started && Date.now() < w.end;
    return h("div.li", { style: live ? { borderColor: "#10B981" } : {} },
      h("div", { style: { minWidth: "72px", fontWeight: 700 } }, w.bn, h("div.small.faint", w.en)),
      h("div.grow.small", tm(w.start), " – ", tm(w.end), live ? h("span.badge.ok", { style: { marginLeft: "6px" } }, "এখন") : null),
      started ? tickBtn(day, w, done, rerender) : h("span.small.faint", "—"));
  }));
  page.append(h("h3", { style: { margin: "14px 2px 8px" } }, "আজ"), listFor(today, W));
  const yN = PRAYERS.filter(p => set.has(yday + ":" + p[0])).length;
  const yBtn = h("button.linkbtn.small", { style: { marginTop: "8px" } }, `গতকাল: ${yN}/5 — মার্ক করতে ভুলে গেলে এখানে ঠিক করুন`);
  yBtn.onclick = () => sheet("গতকালের নামাজ", [listFor(yday, waqts(yday))], { actions: close => [h("button.btn", { onclick: () => { close(null); rerender(); } }, "Done")] });
  page.append(yBtn);

  // graphs
  const days = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29));
  const cnt = d => PRAYERS.filter(p => set.has(d + ":" + p[0])).length;
  page.append(h("div.card.mt", h("h3", "প্রতিদিন কত ওয়াক্ত — শেষ ৩০ দিন"), barChart(days.map(d => ({ l: d.slice(8), v: cnt(d), c: cnt(d) === 5 ? "#10B981" : undefined })), { color: "#6EE7B7" })));
  let full = 0; for (let i = days.length - 1; i >= 0; i--) { if (cnt(days[i]) === 5) full++; else if (days[i] !== today) break; }
  const mo = today.slice(0, 7), moDays = days.filter(d => d.startsWith(mo)).length || 1;
  page.append(h("div.card", h("h3", "এই মাসে কোন নামাজ কতবার"),
    h("div.list", PRAYERS.map(([k, , bn]) => { const n = logs.filter(r => r.prayer === k && r.day.startsWith(mo)).length; return h("div.li", h("b", { style: { minWidth: "70px" } }, bn), h("div.grow", h("div.bar", h("i", { style: { width: Math.min(100, n / moDays * 100) + "%", background: "#10B981" } }))), h("span.small", `${n}/${moDays}`)); })),
    h("p.small.muted.mb0", `টানা ৫ ওয়াক্ত: ${full} দিন 🔥`)));
  const months = Array.from({ length: 6 }, (_, i) => { const x = new Date(today.slice(0, 7) + "-01T00:00:00Z"); x.setUTCMonth(x.getUTCMonth() - 5 + i); return x.toISOString().slice(0, 7); });
  const possible = m => { const dIn = m === mo ? Number(today.slice(8)) : new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate(); return dIn * 5; };
  page.append(h("div.card", h("h3", "মাসিক — কত % ওয়াক্ত পড়েছি"),
    barChart(months.map(m => ({ l: new Date(m + "-01").toLocaleDateString("en-GB", { month: "short" }), v: Math.round(logs.filter(r => r.day.startsWith(m)).length / possible(m) * 100) })), { color: "#10B981", fmt: v => v + "%" })));

  // location
  const locBtn = h("button.btn.small", "📍 আমার লোকেশন দিয়ে সময় ঠিক করুন");
  locBtn.onclick = busy(locBtn, async () => {
    const pos = await new Promise((res, rej) => navigator.geolocation ? navigator.geolocation.getCurrentPosition(res, () => rej(new Error("লোকেশন পাওয়া যায়নি। Settings-এ লোকেশন অনুমতি দিন।")), { timeout: 15000 }) : rej(new Error("এই ফোনে লোকেশন নেই।")));
    const loc = { lat: +pos.coords.latitude.toFixed(4), lng: +pos.coords.longitude.toFixed(4), name: "আমার লোকেশন" };
    await api.update("profiles", `id=eq.${store.profile.id}`, { prayer_loc: loc }); await loadBasics(); toast("সময় আপনার লোকেশন অনুযায়ী ঠিক হয়েছে ✓", "ok"); rerender();
  });
  page.append(h("div.card.small", h("p.small.muted", { style: { margin: "0 0 8px" } }, `সময় হিসাব: ${place().name} (${place().lat}, ${place().lng}) · করাচি পদ্ধতি, আসর হানাফি — ইসলামিক ফাউন্ডেশনের মতো। মসজিদের সময়ের সাথে ১–২ মিনিট পার্থক্য হতে পারে।`), locBtn));
}, { tab: "week" });
