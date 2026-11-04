/* © 2026 Musfiqur Rahman. All rights reserved. Unauthorized copying is prohibited. Proprietary — see LICENSE. */
// Amar Lifestyle — one honest page for any stretch of time: this week (Friday report), any month, or the whole history.
// Every part can be ticked in or out, then saved as one PDF (Save PDF → "Save as PDF").
import * as api from "./api.js";
import { h, icon, todayStr, addDays, fmtDate, durLabel, tk as money, busy, barChart, toast } from "./ui.js";
import { route, store, catColor } from "./app.js";
import { isMuslim } from "./prayer.js";
import { levelOf } from "./me.js";

const mins = t => Math.max(0, Math.round((new Date(t.end_at) - new Date(t.start_at)) / 60000));
const DONE = ["completed", "late_completed"], BAD = ["not_completed", "missed"];
const pctTxt = x => Math.round(x * 100) + "%";
const monthEnd = m => { const [y, mo] = m.split("-").map(Number); return `${y}-${String(mo).padStart(2, "0")}-${String(new Date(y, mo, 0).getDate()).padStart(2, "0")}`; };

async function load(from, to) {
  const q = (t, s) => api.select(t, s).catch(() => []);
  const [tasks, ledger, fin, prayers, hlogs, habits, life, pays, students, exams] = await Promise.all([
    q("tasks", `select=title,category,status,day,start_at,end_at,dp_awarded,done_pct,is_timer&day=gte.${from}&day=lte.${to}&order=start_at&limit=8000`),
    q("dp_ledger", `select=dp,reason,day&day=gte.${from}&day=lte.${to}&limit=20000`),
    q("finance_entries", `select=kind,category,amount,note,entry_date,edit_count&entry_date=gte.${from}&entry_date=lte.${to}&order=entry_date&limit=8000`),
    isMuslim() ? q("prayer_logs", `select=prayer,status,day&day=gte.${from}&day=lte.${to}&limit=8000`) : Promise.resolve(null),
    q("habit_logs", `select=habit_id,day&day=gte.${from}&day=lte.${to}&limit=20000`),
    q("bad_habits", "select=id,name,price"),
    q("life_logs", `select=day,water,slept_at,woke_at,mood&day=gte.${from}&day=lte.${to}&limit=4000`),
    q("tuition_payments", `select=student_id,month,amount,cleared&month=gte.${from.slice(0, 7)}-01&month=lte.${to}`),
    q("students", "select=id,name,monthly_fee,active"),
    q("exams", `select=kind,title,course,due_at,done&due_at=gte.${from}T00:00:00Z&due_at=lte.${to}T23:59:59Z&order=due_at`),
  ]);
  const real = tasks.filter(t => !t.is_timer);
  const done = real.filter(t => DONE.includes(t.status)), bad = real.filter(t => BAD.includes(t.status));
  const share = done.reduce((s, t) => s + (t.done_pct || 100) / 100, 0);
  const workMin = tasks.filter(t => DONE.includes(t.status)).reduce((s, t) => s + mins(t) * (t.done_pct || 100) / 100, 0);
  const byCat = {}; tasks.filter(t => DONE.includes(t.status)).forEach(t => byCat[t.category] = (byCat[t.category] || 0) + mins(t) * (t.done_pct || 100) / 100);
  const days = {}; for (let d = from; d <= to; d = addDays(d, 1)) days[d] = { total: 0, done: 0, dp: 0 };
  real.forEach(t => { const x = days[t.day]; if (x) { x.total++; if (DONE.includes(t.status)) x.done += (t.done_pct || 100) / 100; } });
  ledger.forEach(r => { if (days[r.day]) days[r.day].dp += r.dp; });
  const missedBy = {}; bad.forEach(t => missedBy[t.title] = (missedBy[t.title] || 0) + 1);
  const inc = fin.filter(r => r.kind === "income").reduce((s, r) => s + +r.amount, 0), exp = fin.filter(r => r.kind === "expense").reduce((s, r) => s + +r.amount, 0);
  const expCat = {}; fin.filter(r => r.kind === "expense").forEach(r => expCat[r.category] = (expCat[r.category] || 0) + +r.amount);
  const prayed = prayers ? prayers.filter(p => p.status === "prayed").length : null;
  const nDays = Object.keys(days).length;
  const habitSum = {}; hlogs.forEach(l => habitSum[l.habit_id] = (habitSum[l.habit_id] || 0) + 1);
  const habitLines = Object.entries(habitSum).map(([id, n]) => { const hb = habits.find(x => x.id === id); return hb ? { name: hb.name, n, cost: n * (+hb.price || 0) } : null; }).filter(Boolean);
  const sleepH = life.map(l => l.slept_at && l.woke_at ? ((new Date(`2000-01-02T${l.woke_at}`) - new Date(`2000-01-0${l.woke_at < l.slept_at ? 1 : 2}T${l.slept_at}`)) / 3600e3) : null).filter(x => x > 0 && x < 16);
  return { from, to, tasks, real, done, bad, pct: real.length ? share / real.length : 0, workMin, byCat, days, missedBy, inc, exp, expCat, fin, prayers, prayed, nDays,
    dp: ledger.reduce((s, r) => s + r.dp, 0), habitLines, life, sleepAvg: sleepH.length ? sleepH.reduce((a, b) => a + b, 0) / sleepH.length : null,
    pays, students, exams, activeDays: Object.values(days).filter(x => x.done > 0).length };
}

function facts(D) {
  const top = Object.entries(D.missedBy).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return [
    `Period ${D.from} to ${D.to} (${D.nDays} days). Tasks ${D.done.length} done, ${D.bad.length} not done/missed, of ${D.real.length}. Completion ${pctTxt(D.pct)}. Active days ${D.activeDays}/${D.nDays}.`,
    `Work hours by category: ${JSON.stringify(Object.fromEntries(Object.entries(D.byCat).map(([k, v]) => [k, +(v / 60).toFixed(1)])))}. Total ${(D.workMin / 60).toFixed(1)} h.`,
    `DP ${D.dp}. Most missed: ${top.map(([t, n]) => `${t} ×${n}`).join(", ") || "none"}.`,
    `Income ৳${D.inc}, spent ৳${D.exp}, by category ${JSON.stringify(D.expCat)}.`,
    D.habitLines.length ? `Bad habits: ${D.habitLines.map(x => `${x.name} ×${x.n}${x.cost ? ` ৳${x.cost}` : ""}`).join(", ")}.` : "",
    D.sleepAvg ? `Average sleep ${D.sleepAvg.toFixed(1)} h.` : "",
    D.exams.length ? `Deadlines: ${D.exams.map(e => `${e.title} ${e.done ? "done" : "not done"}`).join(", ")}.` : "",
  ].filter(Boolean).join(" ");
}

// the page itself — a clean paper-like document that prints well
async function render(page, { from, to, title, sub, aiKey, aiAsk, back = "#/reports", nav = null, share = false }) {
  // title on its own line; the buttons sit in a row under it so nothing covers the title
  const acts = h("div.row.doc-acts.noprint", h("button.btn.small.primary", { onclick: () => window.print() }, icon("download"), "Save PDF"));
  page.append(h("header.topbar.noprint", h("div.row", { style: { gap: "10px", minWidth: 0 } }, h("a.icon-btn", { href: back, "aria-label": "Back" }, icon("back")), h("div", { style: { minWidth: 0 } }, h("h1", title), h("div.sub", sub)))), acts);
  // money and habits are inside: PIN first (if one is set)
  const { pinGate, lockedCard } = await import("./pin.js");
  if (!(await pinGate("summary", "Enter PIN"))) { page.append(lockedCard(() => import("./app.js").then(m => m.rerender()))); return; }
  if (nav) page.append(nav);
  page.append(h("p.hint.noprint", "Untick parts you don't want, then Save PDF."));
  const D = await load(from, to);
  if (share) acts.prepend(h("button.btn.small", { onclick: () => shareCard(D, title) }, icon("share"), "Share card"));
  const doc = h("div.doc");
  page.append(doc);
  const p = store.profile;
  doc.append(h("div.doc-head",
    h("div", h("img", { src: "assets/logo-light.png", alt: "Amar Lifestyle", style: { width: "160px" } }), h("div.doc-title", title), h("div.doc-sub", `${p?.name || ""} · ${fmtDate(from, { day: "numeric", month: "short", year: "numeric" })} – ${fmtDate(to, { day: "numeric", month: "short", year: "numeric" })}`)),
    h("div.doc-big", h("b", pctTxt(D.pct)), h("span", "done"))));
  const part = (key, name, kids) => {
    const tick = h("input", { type: "checkbox", checked: true, onchange: e => box.classList.toggle("skip-print", !e.target.checked) });
    const box = h("section.doc-sec", h("div.doc-sec-h", h("h3", name), h("label.noprint.small", tick, " PDF")), kids);
    doc.append(box); return box;
  };
  const kv = (k, v, cls = "") => h("div.doc-kv" + cls, h("span", k), h("b", v));
  part("sum", "Summary", h("div.doc-grid",
    kv("Tasks", `${D.done.length}/${D.real.length}`), kv("Work time", durLabel(Math.round(D.workMin))), kv("DP", (D.dp >= 0 ? "+" : "") + D.dp),
    kv("Active days", `${D.activeDays}/${D.nDays}`), kv("Income", money(D.inc), ".ok"), kv("Spent", money(D.exp), ".bad"),
    D.prayed !== null ? kv("Prayers", `${D.prayed}/${D.nDays * 5}`) : null, D.sleepAvg ? kv("Avg sleep", D.sleepAvg.toFixed(1) + " h") : null,
    D.nDays >= 28 ? kv("Level", levelOf(D.dp)) : null));
  // AI review
  const aiBox = h("div.doc-ai", h("p.small.muted", "✨ Writing AI review…"));
  part("ai", "✨ AI review", aiBox);
  const F = facts(D);
  const runAi = async force => {
    const c = api.LS.get(aiKey);
    if (c && !force && c.facts === F) return drawAi(c.text);
    try {
      const r = await api.ai("ask", { question: `${aiAsk} (কোনো action দিও না, actions: []). সত্যি আর ন্যায্য থাকো — ভালো হলে প্রশংসা, খারাপ হলে পরিষ্কার বলো। DATA: ${F}`, ctx: {}, history: [], today: todayStr() });
      const text = (r.answer || "").trim() || "—"; api.LS.set(aiKey, { facts: F, text }); drawAi(text);
    } catch (e) { aiBox.replaceChildren(h("p.small.muted", e.offline ? "AI needs internet." : e.message)); }
  };
  const drawAi = txt => aiBox.replaceChildren(h("div", { style: { whiteSpace: "pre-wrap", lineHeight: 1.7 } }, txt), (() => { const b = h("button.linkbtn.small.noprint", "↻ Rewrite"); b.onclick = busy(b, () => runAi(true)); return b; })());
  if (D.real.length || D.fin.length) runAi(false); else aiBox.replaceChildren(h("p.small.muted", "No tasks or money in this period."));
  // day by day
  const dl = Object.entries(D.days);
  if (dl.length <= 62) part("days", "By day", barChart(dl.map(([d, x]) => ({ l: dl.length > 10 ? d.slice(8) : fmtDate(d, { weekday: "short" }), v: x.total ? Math.round(100 * x.done / x.total) : 0 })), { fmt: v => v + "%" }));
  else { // long history: month by month
    const byM = {}; dl.forEach(([d, x]) => { const m = d.slice(0, 7); byM[m] = byM[m] || { total: 0, done: 0, dp: 0 }; byM[m].total += x.total; byM[m].done += x.done; byM[m].dp += x.dp; });
    part("months", "By month", h("table.doc-t", h("thead", h("tr", h("th", "Month"), h("th", "done"), h("th", "DP"), h("th", "Level"))),
      h("tbody", Object.entries(byM).map(([m, x]) => h("tr", h("td", new Date(m + "-01").toLocaleDateString("en-GB", { month: "short", year: "numeric" })), h("td", x.total ? pctTxt(x.done / x.total) : "—"), h("td", x.dp), h("td", levelOf(x.dp)))))));
  }
  if (Object.keys(D.byCat).length) part("work", "Where time went", h("div", Object.entries(D.byCat).sort((a, b) => b[1] - a[1]).map(([c, m]) => h("div.doc-bar", h("span", h("i", { style: { background: catColor(c) } }), c), h("div", h("em", { style: { width: Math.round(100 * m / D.workMin) + "%", background: catColor(c) } })), h("b", durLabel(Math.round(m)))))));
  const missed = Object.entries(D.missedBy).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (missed.length) part("missed", "Most missed", h("div", missed.map(([t, n]) => kv(t, `${n}×`, ".bad"))));
  if (D.fin.length) part("money", "Money", h("div",
    h("div.doc-grid", kv("Income", money(D.inc), ".ok"), kv("Spent", money(D.exp), ".bad"), kv("Left", money(D.inc - D.exp), D.inc - D.exp >= 0 ? ".ok" : ".bad")),
    Object.keys(D.expCat).length ? h("div", { style: { marginTop: "10px" } }, Object.entries(D.expCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => kv(c, money(v)))) : null,
    D.fin.length <= 120 ? h("table.doc-t", { style: { marginTop: "10px" } }, h("thead", h("tr", h("th", "Date"), h("th", "Details"), h("th", { style: { textAlign: "right" } }, "Money"))),
      h("tbody", D.fin.map(r => h("tr", h("td", fmtDate(r.entry_date)), h("td", r.category, r.note ? " — " + r.note : "", r.edit_count ? " *" : ""), h("td", { style: { textAlign: "right" } }, (r.kind === "income" ? "+" : "−") + money(+r.amount)))))) : h("p.small.muted", `${D.fin.length} entries — see Money.`)));
  if (D.pays.length) part("tuition", "Tuition fees", h("div", D.students.filter(s => D.pays.some(p => p.student_id === s.id)).map(s => kv(s.name, money(D.pays.filter(p => p.student_id === s.id && !p.cleared).reduce((a, p) => a + +p.amount, 0))))));
  if (D.exams.length) part("exams", "Exams & deadlines", h("div", D.exams.map(e => kv(e.title + (e.course ? " · " + e.course : ""), e.done ? "✓ Done" : "Open", e.done ? ".ok" : ".bad"))));
  if (D.prayers) part("prayer", "🕌 Prayers", h("div.doc-grid", ["fajr", "dhuhr", "asr", "maghrib", "isha"].map(k => kv(k[0].toUpperCase() + k.slice(1), `${D.prayers.filter(p => p.prayer === k && p.status === "prayed").length}/${D.nDays}`))));
  if (D.habitLines.length) part("habits", "Habits", h("div", D.habitLines.map(x => kv(x.name, `${x.n}×${x.cost ? " · " + money(x.cost) : ""}`, ".bad"))));
  doc.append(h("div.doc-foot", `Amar Lifestyle · made ${new Date().toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })} · amarlifestyle.github.io`));
}

// Friday report: the last 7 days
route("weekreport", async page => {
  const to = todayStr(), from = addDays(to, -6);
  await render(page, { share: true, from, to, title: "Weekly report", sub: `${fmtDate(from)} – ${fmtDate(to)}`, back: "#/today", aiKey: "al_weekai_" + to,
    aiAsk: `আমার গত ৭ দিনের রিপোর্ট দেখে বাংলায় সাপ্তাহিক রিভিউ দাও। ফরম্যাট: প্রথম লাইনে সপ্তাহটা এক কথায় (দারুণ / ভালো / মোটামুটি / খারাপ) আর কেন। তারপর "✅ এই সপ্তাহে ভালো:" ৩টা, "⚠️ যেখানে পিছিয়ে:" ২-৩টা, "🎯 পরের সপ্তাহের পরিকল্পনা:" ৩টা নির্দিষ্ট কাজ (দিন/সময় সহ), শেষে এক লাইনের অনুপ্রেরণা।` });
}, { tab: "today" });

// any month (or the whole history)
route("summary", async (page, which) => {
  const today = todayStr(), p = store.profile;
  const first = (p?.created_at || today).slice(0, 10);
  if (which === "all") {
    await render(page, { from: first, to: today, title: "Full history", sub: "Since you started", back: "#/settings", aiKey: "al_allai",
      aiAsk: `আমি এই অ্যাপ শুরু করার দিন থেকে আজ পর্যন্ত পুরো ইতিহাস দেখে বাংলায় একটা সৎ মূল্যায়ন দাও: সামগ্রিক রায়, সবচেয়ে বড় ৩টা উন্নতি, ৩টা দুর্বলতা, টাকার অভ্যাস নিয়ে ২টা কথা, আর সামনে ৩টা পরামর্শ।` });
    return;
  }
  const m = /^\d{4}-\d{2}$/.test(which || "") ? which : (() => { const d = new Date(today.slice(0, 7) + "-01T00:00:00"); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); })();
  const months = []; for (let d = new Date(first.slice(0, 7) + "-01T00:00:00"); d.toISOString().slice(0, 7) <= today.slice(0, 7); d.setMonth(d.getMonth() + 1)) months.push(d.toISOString().slice(0, 7));
  const pick = h("select.input.noprint", { style: { marginBottom: "10px" }, onchange: e => location.hash = `#/summary/${e.target.value}` },
    months.reverse().map(x => h("option", { value: x, selected: x === m }, new Date(x + "-01").toLocaleDateString("en-GB", { month: "long", year: "numeric" }) + (x === today.slice(0, 7) ? " (current)" : ""))));
  const to = m === today.slice(0, 7) ? today : monthEnd(m);
  await render(page, { from: m + "-01", to, title: "Month summary", sub: new Date(m + "-01").toLocaleDateString("en-GB", { month: "long", year: "numeric" }), aiKey: "al_monthai_" + m, nav: pick,
    aiAsk: `আমার এই মাসের পুরো হিসাব দেখে বাংলায় সৎ মাসিক মূল্যায়ন দাও। ফরম্যাট: প্রথম লাইনে মাসটা এক কথায় আর কেন। তারপর "✅ ভালো যা হয়েছে:" ৩টা, "⚠️ সমস্যা:" ৩টা (কোথায়, কত বার), "💰 টাকা:" ২টা কথা, "🎯 পরের মাসে:" ৩টা নির্দিষ্ট লক্ষ্য।` });
}, { tab: "more" });

// a picture of the week to post on Facebook / WhatsApp (no money, no task names)
async function shareCard(D, title) {
  const W = 1080, H = 1350, c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#0B1220"); g.addColorStop(1, "#13263A"); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = "rgba(45,212,191,.12)"; x.beginPath(); x.arc(W - 120, 160, 260, 0, 7); x.fill();
  const F = "-apple-system, Segoe UI, Roboto, 'Noto Sans Bengali', sans-serif";
  x.fillStyle = "#2DD4BF"; x.font = `700 44px ${F}`; x.fillText("Amar Lifestyle", 80, 130);
  x.fillStyle = "#94A3B8"; x.font = `500 36px ${F}`; x.fillText(`${title} · ${fmtDate(D.from)} – ${fmtDate(D.to)}`, 80, 190);
  x.fillStyle = "#EEF2F7"; x.font = `700 52px ${F}`; x.fillText(store.profile?.name || "", 80, 290);
  // big ring
  const pct = Math.round(D.pct * 100), cx = W / 2, cy = 590, r = 210;
  x.lineWidth = 42; x.strokeStyle = "rgba(148,163,184,.15)"; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke();
  const rg = x.createLinearGradient(cx - r, cy - r, cx + r, cy + r); rg.addColorStop(0, "#22D3EE"); rg.addColorStop(1, "#4ADE80");
  x.strokeStyle = rg; x.lineCap = "round"; x.beginPath(); x.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * D.pct); x.stroke();
  x.textAlign = "center"; x.fillStyle = "#EEF2F7"; x.font = `800 130px ${F}`; x.fillText(pct + "%", cx, cy + 40);
  x.fillStyle = "#94A3B8"; x.font = `500 36px ${F}`; x.fillText("tasks done", cx, cy + 100);
  const stats = [[(D.dp >= 0 ? "+" : "") + D.dp, "DP"], [(D.workMin / 60).toFixed(1) + "h", "work"], [`${D.activeDays}/${D.nDays}`, "active days"]];
  stats.forEach(([v, l], i) => {
    const bx = 80 + i * 320, by = 900;
    x.fillStyle = "rgba(255,255,255,.06)"; x.beginPath(); x.roundRect(bx, by, 280, 200, 32); x.fill();
    x.fillStyle = "#EEF2F7"; x.font = `800 72px ${F}`; x.fillText(v, bx + 140, by + 110);
    x.fillStyle = "#94A3B8"; x.font = `500 32px ${F}`; x.fillText(l, bx + 140, by + 160);
  });
  x.fillStyle = "#64748B"; x.font = `500 32px ${F}`; x.fillText("amarlifestyle.github.io", W / 2, H - 80);
  const blob = await new Promise(ok => c.toBlob(ok, "image/png"));
  const file = new File([blob], "my-week.png", { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], text: "My week on Amar Lifestyle — amarlifestyle.github.io" }); return; } catch { return; } }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "my-week.png"; a.click();
  toast("Picture saved ✓", "ok");
}
