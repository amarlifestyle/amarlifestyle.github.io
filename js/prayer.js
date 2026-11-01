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
  const out = {};
  for (const [k, v] of Object.entries(t)) {
    const local = v + 6 - loc.lng / 15; // hours in Dhaka time (UTC+6)
    out[k] = new Date(Date.UTC(y, m - 1, d, 0, Math.round(local * 60)) - 6 * 3600e3);
  }
  return out;
}
// Safety margins (ihtiyat), so a salah is never shown before its waqt or as valid after it:
// each waqt STARTS a few minutes after the calculated moment and ENDS a little before the next one.
const SAFE_START = { fajr: 2, dhuhr: 3, asr: 2, maghrib: 3, isha: 2 };
const plus = (d, m) => new Date(d.getTime() + m * 60000);
const adj = () => place().adj || {};
// each waqt: when it starts and ends
export function waqts(day) {
  const t = timesFor(day), nx = timesFor(addDays(day, 1)), a = adj();
  const st = k => plus(t[k], SAFE_START[k] + (Number(a[k]) || 0));
  return [
    { key: "fajr", start: st("fajr"), end: plus(t.sunrise, -3) },
    { key: "dhuhr", start: st("dhuhr"), end: plus(t.asr, -1) },
    { key: "asr", start: st("asr"), end: plus(t.maghrib, -1) },
    { key: "maghrib", start: st("maghrib"), end: plus(t.isha, -1) },
    { key: "isha", start: st("isha"), end: plus(nx.fajr, -1) },
  ].map(w => ({ ...w, bn: BN[w.key], en: PRAYERS.find(p => p[0] === w.key)[1] }));
}
const tm = d => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" });
const left = ms => { const m = Math.max(0, Math.round(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; };
const C = "#10B981";
const pdp = () => Number(store.cfg.prayer_dp ?? 20), pen = () => Number(store.cfg.prayer_unmarked_dp ?? 10);

export async function prayerLogs(from, to) {
  try { return await api.select("prayer_logs", `select=day,prayer,status,dp&day=gte.${from}&day=lte.${to}`); } catch { return []; }
}
// can this day still be marked? today, or yesterday until 6 AM (for Isha after midnight)
const canMark = day => day === todayStr() || (day === addDays(todayStr(), -1) && dhakaHour() < 6);
const dhakaHour = () => (new Date().getUTCHours() + 6) % 24;
// two answers: prayed / not prayed
function answerBtns(day, w, status, after) {
  if (status === "unmarked") return h("span.small", { style: { color: "var(--red)" } }, `মার্ক করা হয়নি · −${pen()} DP`);
  if (!canMark(day)) return h("span.small.faint", status === "prayed" ? "✓ পড়েছি" : status === "not_prayed" ? "পড়িনি" : "—");
  const send = st => async e => {
    e?.stopPropagation?.();
    const r = await api.rpc("mark_prayer", { p_day: day, p_prayer: w.key, p_status: st });
    toast(st === "prayed" ? `${w.bn} ✓ আলহামদুলিল্লাহ · +${r.dp} DP` : "ঠিক আছে — পরের ওয়াক্তে ইনশাআল্লাহ। (DP কাটা হয়নি)", st === "prayed" ? "ok" : "");
    after();
  };
  const yes = h("button.btn.small" + (status === "prayed" ? ".primary" : ""), { type: "button" }, status === "prayed" ? "✓ পড়েছি" : `পড়েছি +${pdp()}`);
  const no = h("button.btn.small" + (status === "not_prayed" ? ".danger" : ""), { type: "button" }, "পড়িনি");
  yes.onclick = busy(yes, send("prayed")); no.onclick = busy(no, send("not_prayed"));
  return h("div.row", { style: { gap: "6px", flexShrink: 0 } }, yes, no);
}

// Today page: only the waqt that is running now (small card above the task list)
export async function prayerNow() {
  if (!isMuslim()) return null;
  const today = todayStr(), now = Date.now();
  let day = today, w = waqts(today).find(x => now >= x.start && now < x.end);
  if (!w) { const y = waqts(addDays(today, -1))[4]; if (now >= y.start && now < y.end) { w = y; day = addDays(today, -1); } }
  if (!w) return null;
  const st = (await prayerLogs(day, day)).find(r => r.prayer === w.key)?.status;
  return h("div.card", { style: { padding: "8px 12px", marginBottom: "10px", borderColor: `color-mix(in srgb, ${C} 55%, transparent)`, background: `color-mix(in srgb, ${C} 8%, var(--card))` } },
    h("div.row.between", { style: { gap: "8px", alignItems: "center" } },
      h("a", { href: "#/prayer", style: { color: "inherit", minWidth: 0 } },
        h("div", h("b", "🕌 এখন ", w.bn, "ের ওয়াক্ত")),
        h("div.small.muted", `শেষ ${tm(w.end)} · ${left(w.end - now)} বাকি`)),
      answerBtns(day, w, st, rerender)));
}
// one line for the night report
export async function prayerCount(day) {
  if (!isMuslim()) return null;
  return (await prayerLogs(day, day)).filter(r => r.status === "prayed").length;
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
  const logs = await prayerLogs(from, today);
  const stOf = new Map(logs.map(r => [r.day + ":" + r.prayer, r.status]));
  const set = new Set(logs.filter(r => r.status === "prayed").map(r => r.day + ":" + r.prayer));
  const W = waqts(today), now = Date.now();
  const cur = W.find(w => now >= w.start && now < w.end) || (now < W[0].start ? { ...waqts(yday)[4] } : null);
  const next = W.find(w => w.start > now) || waqts(addDays(today, 1))[0];
  const todayN = W.filter(w => set.has(today + ":" + w.key)).length;

  page.append(h("div.hero", { style: { flexDirection: "column", alignItems: "stretch", gap: "4px" } },
    cur ? h("div", h("span.small.muted", "এখন ওয়াক্ত চলছে"), h("div.big", "🕌 ", cur.bn), h("div.small.muted", `শেষ ${tm(cur.end)} · ${left(cur.end - now)} বাকি`)) : h("div.big", "🕌 এখন কোনো ফরজ নামাজের ওয়াক্ত নেই"),
    h("div.small", "পরের নামাজ: ", h("b", next.bn), ` ${tm(next.start)} (${left(next.start - now)} পর)`),
    h("div.small", "আজ পড়েছি: ", h("b", `${todayN}/5`), " ওয়াক্ত")));

  const listFor = (day, ws) => h("div.list", ws.map(w => {
    const status = stOf.get(day + ":" + w.key), started = Date.now() >= w.start, live = started && Date.now() < w.end;
    return h("div.li", { style: live ? { borderColor: "#10B981" } : {} },
      h("div", { style: { minWidth: "72px", fontWeight: 700 } }, w.bn, h("div.small.faint", w.en)),
      h("div.grow.small", tm(w.start), " – ", tm(w.end), live ? h("span.badge.ok", { style: { marginLeft: "6px" } }, "এখন") : null),
      started || status ? answerBtns(day, w, status, rerender) : h("span.small.faint", "—"));
  }));
  page.append(h("h3", { style: { margin: "14px 2px 8px" } }, "আজ"), listFor(today, W));
  if (canMark(yday)) {
    const yN = PRAYERS.filter(p => set.has(yday + ":" + p[0])).length;
    const yBtn = h("button.linkbtn.small", { style: { marginTop: "8px" } }, `গতকাল: ${yN}/5 — সকাল ৬টার আগে পর্যন্ত মার্ক করা যাবে`);
    yBtn.onclick = () => sheet("গতকালের নামাজ", [listFor(yday, waqts(yday))], { actions: close => [h("button.btn", { onclick: () => { close(null); rerender(); } }, "Done")] });
    page.append(yBtn);
  }
  page.append(h("div.card.small.mt", h("b", "পয়েন্টের নিয়ম"), h("p.small.muted.mb0", { style: { marginTop: "4px" } },
    `পড়েছি = +${pdp()} DP (যেকোনো টাস্কের এক ঘণ্টার চেয়ে বেশি) · পড়িনি = ০ (কিছু কাটা হয় না) · কিছুই মার্ক না করলে পরদিন সকাল ৬টায় ওই ওয়াক্তে −${pen()} DP। ওয়াক্ত শুরু হওয়ার পরই মার্ক করা যায়।`)));

  // graphs
  const days = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29));
  const cnt = d => PRAYERS.filter(p => set.has(d + ":" + p[0])).length;
  page.append(h("div.card.mt", h("h3", "প্রতিদিন কত ওয়াক্ত — শেষ ৩০ দিন"), barChart(days.map(d => ({ l: d.slice(8), v: cnt(d), c: cnt(d) === 5 ? "#10B981" : undefined })), { color: "#6EE7B7" })));
  let full = 0; for (let i = days.length - 1; i >= 0; i--) { if (cnt(days[i]) === 5) full++; else if (days[i] !== today) break; }
  const mo = today.slice(0, 7), moDays = days.filter(d => d.startsWith(mo)).length || 1;
  page.append(h("div.card", h("h3", "এই মাসে কোন নামাজ কতবার"),
    h("div.list", PRAYERS.map(([k, , bn]) => { const n = logs.filter(r => r.status === "prayed" && r.prayer === k && r.day.startsWith(mo)).length; return h("div.li", h("b", { style: { minWidth: "70px" } }, bn), h("div.grow", h("div.bar", h("i", { style: { width: Math.min(100, n / moDays * 100) + "%", background: "#10B981" } }))), h("span.small", `${n}/${moDays}`)); })),
    h("p.small.muted.mb0", `টানা ৫ ওয়াক্ত: ${full} দিন 🔥`)));
  const months = Array.from({ length: 6 }, (_, i) => { const x = new Date(today.slice(0, 7) + "-01T00:00:00Z"); x.setUTCMonth(x.getUTCMonth() - 5 + i); return x.toISOString().slice(0, 7); });
  const possible = m => { const dIn = m === mo ? Number(today.slice(8)) : new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate(); return dIn * 5; };
  page.append(h("div.card", h("h3", "মাসিক — কত % ওয়াক্ত পড়েছি"),
    barChart(months.map(m => ({ l: new Date(m + "-01").toLocaleDateString("en-GB", { month: "short" }), v: Math.round(logs.filter(r => r.status === "prayed" && r.day.startsWith(m)).length / possible(m) * 100) })), { color: "#10B981", fmt: v => v + "%" })));

  // location
  const locBtn = h("button.btn.small", "📍 আমার লোকেশন দিয়ে সময় ঠিক করুন");
  locBtn.onclick = busy(locBtn, async () => {
    const pos = await new Promise((res, rej) => navigator.geolocation ? navigator.geolocation.getCurrentPosition(res, () => rej(new Error("লোকেশন পাওয়া যায়নি। Settings-এ লোকেশন অনুমতি দিন।")), { timeout: 15000 }) : rej(new Error("এই ফোনে লোকেশন নেই।")));
    const loc = { ...(store.profile.prayer_loc || {}), lat: +pos.coords.latitude.toFixed(4), lng: +pos.coords.longitude.toFixed(4), name: "আমার লোকেশন" };
    await api.update("profiles", `id=eq.${store.profile.id}`, { prayer_loc: loc }); await loadBasics(); toast("সময় আপনার লোকেশন অনুযায়ী ঠিক হয়েছে ✓", "ok"); rerender();
  });
  const adjBtn = h("button.btn.small", "🕌 মসজিদের সময়ের সাথে মেলান");
  adjBtn.onclick = () => adjustSheet();
  page.append(h("div.card.small", h("p.small.muted", { style: { margin: "0 0 8px" } },
    `সময় হিসাব: ${place().name} (${place().lat}, ${place().lng}) · ইসলামিক ফাউন্ডেশন বাংলাদেশের পদ্ধতি (ফজর ও এশা ১৮°, আসর হানাফি)। সাবধানতার জন্য প্রতিটা ওয়াক্ত হিসাবের সময়ের ২–৩ মিনিট পরে শুরু ও ১–৩ মিনিট আগে শেষ দেখানো হয়, যাতে ওয়াক্তের আগে নামাজ না হয়ে যায়। সন্দেহ হলে আপনার মসজিদের সময় মেনে চলুন।`),
    h("div.row.wrap", { style: { gap: "8px" } }, locBtn, adjBtn)));
}, { tab: "week" });

// move each start time by a few minutes to match the local mosque
function adjustSheet() {
  const a = adj();
  const ins = PRAYERS.map(([k, , bn]) => [k, bn, h("input.input", { type: "number", min: "-15", max: "30", step: "1", value: a[k] || 0, style: { width: "90px" } })]);
  sheet("মসজিদের সময়ের সাথে মেলান", [h("p.hint", "প্রতিটা ওয়াক্ত কত মিনিট পরে শুরু ধরবেন (+) বা আগে (−)। শুধু মসজিদ/ক্যালেন্ডারের সাথে মিলিয়ে বদলান।"),
    h("div.list", ins.map(([k, bn, inp]) => h("div.li", h("b.grow", bn), inp, h("span.small.muted", " মিনিট"))))], {
    actions: close => {
      const sv = h("button.btn.primary", "Save");
      sv.onclick = busy(sv, async () => {
        const n = {}; for (const [k, , inp] of ins) { const v = Math.round(Number(inp.value) || 0); if (v < -15 || v > 30) throw new Error("−15 থেকে +30 মিনিটের মধ্যে দিন।"); if (v) n[k] = v; }
        await api.update("profiles", `id=eq.${store.profile.id}`, { prayer_loc: { ...(store.profile.prayer_loc || DHAKA), adj: n } });
        await loadBasics(); toast("Saved ✓", "ok"); close(true); rerender();
      });
      return [h("button.btn", { onclick: () => close(null) }, "Cancel"), sv];
    },
  });
}
