/* © 2026 Musfiqur Rahman. All rights reserved. Unauthorized copying is prohibited. Proprietary — see LICENSE. */
// Amar Lifestyle — Exams: class tests, lab reports, assignments. Reminders get more frequent as the day comes.
import * as api from "./api.js";
import { h, icon, toast, sheet, busy, confirmBox, todayStr, addDays, fmtDate, pad, swipeAway } from "./ui.js";
import { route, rerender, store, myRoles } from "./app.js";

export const EXAM_KINDS = {
  ct: ["📝", "CT"], lab: ["🧪", "Lab report"], assignment: ["📄", "Assignment"], exam: ["🎓", "Exam"],
  paper: ["🖨️", "Question paper"], checking: ["✍️", "Script checking"], result: ["📊", "Result submit"],
  delivery: ["📦", "Delivery"], payment: ["💰", "Payment"], meeting: ["🤝", "Meeting"],
  report: ["📑", "Report"], presentation: ["📽️", "Presentation"],
  appointment: ["🩺", "Appointment"], fee: ["🏫", "School fee"], shopping: ["🛒", "Shopping"], occasion: ["🎉", "Occasion"],
  other: ["📌", "Other"],
};
// each kind of person gets the deadlines that fit their day
const ROLE_DEADLINES = {
  school: { tab: "📝 Exams", sub: "Class tests & exams", add: "Add CT / exam", kinds: ["ct", "exam", "assignment", "other"], eg: "e.g. Physics CT — chapter 3" },
  student: { tab: "📝 Exams", sub: "CT, lab reports & exams", add: "Add CT / lab report / exam", kinds: ["ct", "lab", "assignment", "exam", "presentation", "other"], eg: "e.g. CT-2: Kinematics" },
  teacher: { tab: "📋 Exam work", sub: "Question papers, checking & results", add: "Add exam work", kinds: ["paper", "checking", "result", "exam", "meeting", "other"], eg: "e.g. Class 9 Physics question paper" },
  business: { tab: "📦 Deadlines", sub: "Deliveries, payments & meetings", add: "Add deadline", kinds: ["delivery", "payment", "meeting", "report", "other"], eg: "e.g. 50 pcs order to Rahim Traders" },
  job: { tab: "📌 Deadlines", sub: "Reports, meetings & presentations", add: "Add deadline", kinds: ["report", "meeting", "presentation", "exam", "other"], eg: "e.g. Monthly sales report" },
  homemaker: { tab: "🗓️ Reminders", sub: "Appointments, fees & occasions", add: "Add reminder", kinds: ["appointment", "fee", "payment", "shopping", "occasion", "other"], eg: "e.g. Doctor appointment — Ammu" },
};
export const deadlines = () => {
  const rs = myRoles().map(k => ROLE_DEADLINES[k]).filter(Boolean);
  if (!rs.length) return ROLE_DEADLINES.student;
  if (rs.length === 1) return rs[0];
  return { tab: "📌 Deadlines", sub: rs.map(r => r.sub).join(" · "), add: "Add deadline", kinds: [...new Set(rs.flatMap(r => r.kinds.filter(k => k !== "other")))].concat("other"), eg: rs[0].eg };
};
const isStudy = () => myRoles().some(k => ["student", "school", "teacher"].includes(k)) || !myRoles().length;
const when = iso => new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Dhaka" });
export function leftLabel(iso) {
  const ms = new Date(iso) - Date.now();
  if (ms <= 0) return "Time over";
  const hrs = ms / 3600e3;
  if (hrs < 1) return `${Math.max(1, Math.round(ms / 60000))} min left`;
  if (hrs < 48) return `${Math.floor(hrs)}h left`;
  return `${Math.floor(hrs / 24)} days left`;
}
const urgency = iso => { const hrs = (new Date(iso) - Date.now()) / 3600e3; return hrs <= 24 ? "var(--red)" : hrs <= 72 ? "var(--amber)" : "var(--brand)"; };

export async function upcomingExams(days = 3) {
  try { return await api.select("exams", `select=*&done=eq.false&hide_home=eq.false&due_at=gt.${new Date().toISOString()}&due_at=lt.${new Date(Date.now() + days * 864e5).toISOString()}&order=due_at`); } catch { return []; }
}
// Today page: small rows inside the shared box
export async function examRows() {
  let list = await upcomingExams(3);
  // the very next one is always shown, however far away it is
  if (!list.length) {
    try { list = await api.select("exams", `select=*&done=eq.false&hide_home=eq.false&due_at=gt.${new Date().toISOString()}&order=due_at&limit=1`); } catch { /* offline */ }
  }
  return list.slice(0, 3).map(e => ({ e, ic: EXAM_KINDS[e.kind][0], title: e.title, sub: [EXAM_KINDS[e.kind][1], e.course].filter(Boolean).join(" · "), left: leftLabel(e.due_at).replace(" left", ""), color: urgency(e.due_at) }));
}
// Today page: what is due in the next 3 days
export async function examsCard() {
  const list = await upcomingExams(3);
  if (!list.length) return null;
  return h("a.card.exams-card", { href: "#/exams" },
    list.slice(0, 3).map(e => h("div.row.between", { style: { gap: "8px", padding: "3px 0" } },
      h("span.ell", EXAM_KINDS[e.kind][0], " ", h("b", e.title), e.course ? h("span.muted", " · ", e.course) : null),
      h("span.small", { style: { color: urgency(e.due_at), whiteSpace: "nowrap", fontWeight: 600 } }, leftLabel(e.due_at)))),
    list.length > 3 ? h("div.small.muted", `+${list.length - 3} more`) : null);
}

route("exams", async page => {
  const { routineTabsAsync, shareSwitch } = await import("./timetable.js");
  const U = await import("./undo.js");
  const R = deadlines();
  page.append(h("header.topbar", h("div", h("h1", "Routine"), h("div.sub", R.sub))), await routineTabsAsync("exams"));
  page.append(h("div.row", { style: { justifyContent: "space-between", margin: "-4px 0 6px", gap: "8px" } }, await shareSwitch(), U.undoButtons()));
  const all = await api.select("exams", "select=*&order=due_at");
  const now = Date.now();
  // time over → it stays under "Done & past" for one day, then disappears by itself
  const open = all.filter(e => !e.done && new Date(e.due_at) > now), past = all.filter(e => (e.done || new Date(e.due_at) <= now) && new Date(e.due_at) > now - 864e5).reverse().slice(0, 15);
  page.append(h("div.grid2", { style: { gap: "8px" } },
    h("button.btn.primary", { onclick: () => examSheet() }, icon("plus"), R.add),
    h("button.btn", { onclick: () => import("./assistant.js").then(m => m.askSheet({ photo: true, text: "এই ছবি দেখে সব CT / ল্যাব রিপোর্ট / পরীক্ষা / ডেডলাইন তারিখ-সময় সহ যোগ করো" })) }, "📷 From a photo (AI)")));
  if (isStudy()) page.append(h("a.li.syl-link", { href: "#/syllabus", style: { marginTop: "10px" } }, h("div.ic", "📚"), h("div.grow", h("b", "Syllabus"), h("div.small.muted", "Chapters per exam, % done")), icon("chev", "chev")));
  const row = e => {
    const gone = async () => { await removeExamUndo(e); rerender(); };
    const x = h("button.s-x", { type: "button", "aria-label": "Delete" }, "✕");
    x.onclick = busy(x, async ev => { ev?.stopPropagation?.(); await gone(); });
    const over = !e.done && new Date(e.due_at) <= now;
    const r = h("div.li" + (e.done || over ? ".over" : ""), { onclick: ev => { if (!x.contains(ev.target) && !r.dataset.swiped) examSheet(e); }, style: { cursor: "pointer" } },
      h("div.ic", EXAM_KINDS[e.kind][0]),
      h("div.grow", { style: { minWidth: 0 } }, h("b", { style: { textDecoration: e.done ? "line-through" : "" } }, e.title), h("div.small.muted", [EXAM_KINDS[e.kind][1], e.course, when(e.due_at)].filter(Boolean).join(" · "))),
      e.marks_got != null && e.marks_total != null ? h("span.badge.ok", `${+Number(e.marks_got)}/${+Number(e.marks_total)}`) : e.done ? h("span.badge.ok", "✓ " + doneWord(e.kind)) : over ? h("span.small.muted", { style: { whiteSpace: "nowrap" } }, "Time over") : h("span.small", { style: { color: urgency(e.due_at), fontWeight: 600, whiteSpace: "nowrap" } }, leftLabel(e.due_at)), x);
    swipeAway(r, gone);
    return r;
  };
  // month calendar (week starts Saturday) — the whole month at a glance
  page.append(await examCalendar(all, examSheet));
  // then week by week
  page.append(h("div.section-title", h("h2", "Coming up — week by week")));
  if (!open.length) page.append(h("div.card.empty", h("p", "Nothing due right now.")));
  const dk = e => new Date(new Date(e.due_at).getTime() + 6 * 3600e3).toISOString().slice(0, 10);
  const wkStart = d => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 1) % 7)); return x.toISOString().slice(0, 10); };
  const thisWk = wkStart(todayStr());
  const weeks = [...new Set(open.map(e => wkStart(dk(e))))].sort();
  for (const w of weeks) {
    const items = open.filter(e => wkStart(dk(e)) === w);
    const we = addDays(w, 6);
    const label = w === thisWk ? "This week" : w === addDays(thisWk, 7) ? "Next week" : "Week of " + fmtDate(w, { day: "numeric", month: "short" });
    const days = [...new Set(items.map(dk))].sort();
    page.append(h("div.ex-week",
      h("div.ex-week-h", h("b", label), h("span.small.muted", `${fmtDate(w, { day: "numeric", month: "short" })} – ${fmtDate(we, { day: "numeric", month: "short" })} · ${items.length}`)),
      days.map(d => h("div.ex-day", h("div.ex-day-h", fmtDate(d, { weekday: "short", day: "numeric", month: "short" }), d === todayStr() ? h("span.ex-today", "today") : null),
        h("div.list", items.filter(e => dk(e) === d).map(row))))));
  }
  page.append(h("p.hint.mt", "Reminders: daily → twice a day in the last week → 3 times in the last 3 days → every 3 hours in the last 2 days → every 2 hours on the last day → every hour in the last 3 hours."));
  if (isStudy()) page.append(resultsBlock(all));
  if (past.length) page.append(h("div.section-title", h("h2", "Done & past")), h("div.list", past.map(row)), h("p.small.muted.mt", "Items whose time is over disappear after one day · swipe left or ✕ to delete now."));
}, { tab: "week" });

// delete with Undo (the row is kept in memory to put it back)
export async function removeExamUndo(e) {
  await api.remove("exams", `id=eq.${e.id}`);
  const { created_at, ...back } = e;
  import("./undo.js").then(U => U.record(`“${e.title}” deleted`, () => api.insert("exams", back), () => api.remove("exams", `id=eq.${e.id}`)));
}
// ---------- marks
function readMarks(got, tot) {
  const g = got.value === "" ? null : Number(got.value), t = tot.value === "" ? null : Number(tot.value);
  if ((g === null) !== (t === null)) throw new Error("Write both: marks got and out of.");
  if (t !== null && !(t > 0)) throw new Error("“Out of” must be more than 0.");
  if (g !== null && (g < 0 || g > t)) throw new Error("Marks got can't be more than the total.");
  return { marks_got: g, marks_total: t };
}
const pctOf = e => Math.round(100 * Number(e.marks_got) / Number(e.marks_total));
const pctColor = p => p >= 80 ? "var(--green)" : p >= 60 ? "var(--amber)" : "var(--red)";
export function marksSheet(e) {
  const got = h("input.input", { type: "number", inputmode: "decimal", min: "0", step: "0.25", placeholder: "e.g. 17", value: e.marks_got ?? "" });
  const tot = h("input.input", { type: "number", inputmode: "decimal", min: "1", step: "0.25", placeholder: "e.g. 20", value: e.marks_total ?? (e.kind === "ct" ? 20 : "") });
  setTimeout(() => got.focus(), 300);
  sheet("Marks · " + e.title, [h("div.grid2", h("label.f", h("span", "Marks got"), got), h("label.f", h("span", "Out of"), tot))], {
    actions: close => {
      const save = h("button.btn.primary", "Save");
      save.onclick = busy(save, async () => {
        const m = readMarks(got, tot);
        await api.update("exams", `id=eq.${e.id}`, { ...m, ...(m.marks_got !== null ? { done: true } : {}) });
        toast("Marks saved ✓", "ok"); close(true); rerender();
      });
      return [h("button.btn", { onclick: () => close(null) }, "Cancel"), save];
    },
  });
}
const MARKABLE = ["ct", "exam", "lab", "assignment", "presentation"];
// results by course + the ones still waiting for marks
function resultsBlock(all) {
  const now = Date.now();
  const marked = all.filter(e => e.marks_got != null && e.marks_total != null).sort((a, b) => b.due_at.localeCompare(a.due_at));
  const waiting = all.filter(e => MARKABLE.includes(e.kind) && e.marks_got == null && (e.done || new Date(e.due_at) <= now) && new Date(e.due_at) > now - 120 * 864e5)
    .sort((a, b) => b.due_at.localeCompare(a.due_at));
  const out = h("div");
  if (marked.length) {
    const courses = {};
    marked.forEach(e => { const k = e.course || "Other"; (courses[k] = courses[k] || []).push(e); });
    const rows = Object.entries(courses).map(([c, l]) => {
      const sg = l.reduce((a, e) => a + Number(e.marks_got), 0), st = l.reduce((a, e) => a + Number(e.marks_total), 0), p = Math.round(100 * sg / st);
      return h("div.res-c", h("div.row.between", h("b", c), h("span", { style: { color: pctColor(p), fontWeight: 700 } }, p + "%")),
        h("div.res-bar", h("i", { style: { width: p + "%", background: pctColor(p) } })),
        h("div.small.muted", `${l.length} result${l.length > 1 ? "s" : ""} · ${+sg.toFixed(2)}/${+st.toFixed(2)}`));
    });
    const totG = marked.reduce((a, e) => a + Number(e.marks_got), 0), totT = marked.reduce((a, e) => a + Number(e.marks_total), 0);
    out.append(h("div.section-title", h("h2", "Results"), h("span.small.muted", `Overall ${Math.round(100 * totG / totT)}%`)),
      h("div.card", rows),
      h("div.list", { style: { marginTop: "8px" } }, marked.slice(0, 12).map(e => h("button.li" + (e.done || new Date(e.due_at) <= new Date() ? ".over" : ""), { type: "button", style: { textAlign: "left" }, onclick: () => marksSheet(e) },
        h("div.ic", EXAM_KINDS[e.kind]?.[0] || "📌"), h("div.grow", { style: { minWidth: 0 } }, h("b.ell", e.title), h("div.small.muted", [e.course, new Date(e.due_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Dhaka" })].filter(Boolean).join(" · "))),
        h("div", { style: { textAlign: "right" } }, h("b", `${+Number(e.marks_got)}/${+Number(e.marks_total)}`), h("div.small", { style: { color: pctColor(pctOf(e)), fontWeight: 700 } }, pctOf(e) + "%"))))));
  }
  if (waiting.length) out.append(h("details.fold.mt", { open: !marked.length }, h("summary", `Waiting for marks · ${waiting.length}`),
    h("div.list", waiting.map(e => h("div.li", h("div.ic", EXAM_KINDS[e.kind]?.[0] || "📌"), h("div.grow", { style: { minWidth: 0 } }, h("b.ell", e.title), h("div.small.muted", [e.course, new Date(e.due_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Dhaka" })].filter(Boolean).join(" · "))),
      h("button.btn.small", { type: "button", onclick: () => marksSheet(e) }, icon("plus"), "Marks"))))));
  return out;
}

// ---------- calendar view
const KIND_COLOR = { ct: "var(--amber)", lab: "var(--cyan)", assignment: "var(--pink)", exam: "var(--red)", presentation: "var(--green)" };
const shortKind = e => /quiz/i.test(e.title) ? "Quiz" : ({ ct: "CT", lab: "Lab", assignment: "Assign.", exam: "Exam", presentation: "Present." }[e.kind] || EXAM_KINDS[e.kind]?.[1] || "Due");
let calMonth = null; // YYYY-MM-01 shown in the calendar
async function examCalendar(all, openSheet) {
  const today = todayStr();
  if (!calMonth) calMonth = today.slice(0, 8) + "01";
  const m = calMonth, y = +m.slice(0, 4), mo = +m.slice(5, 7);
  const days = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const first = new Date(Date.UTC(y, mo - 1, 1)).getUTCDay(); // 0 Sun
  const lead = (first + 1) % 7; // Saturday first
  const dk = e => new Date(new Date(e.due_at).getTime() + 6 * 3600e3).toISOString().slice(0, 10);
  const byDay = {};
  all.forEach(e => { const d = dk(e); if (d.startsWith(m.slice(0, 7))) (byDay[d] = byDay[d] || []).push(e); });
  let events = [];
  try { events = await api.select("events", `select=title,date,yearly&date=gte.${m}&date=lte.${m.slice(0, 8)}${pad(days)}`); } catch { /* offline */ }
  const evDay = {}; events.forEach(e => (evDay[e.date] = evDay[e.date] || []).push(e));
  const shift = n => { const d = new Date(Date.UTC(y, mo - 1 + n, 1)); calMonth = d.toISOString().slice(0, 10); rerender(); };
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(h("div.cal-c.blank"));
  for (let d = 1; d <= days; d++) {
    const ds = `${m.slice(0, 8)}${pad(d)}`, items = (byDay[ds] || []).sort((a, b) => a.due_at.localeCompare(b.due_at)), ev = evDay[ds] || [];
    const c = h("button.cal-c" + (ds === today ? ".today" : "") + (ds < today ? ".past" : "") + (items.length ? ".has" : ""), { type: "button", "aria-label": fmtDate(ds) },
      h("span.cal-n", String(d)),
      items.slice(0, 2).map(e => h("span.cal-chip" + (e.done ? ".done" : "") + (e.done || new Date(e.due_at) <= new Date() ? ".over" : ""), { style: { "--k": KIND_COLOR[e.kind] || "var(--brand)" } }, shortKind(e))),
      items.length > 2 ? h("span.cal-more", `+${items.length - 2}`) : null,
      ev.length ? h("i.cal-ev", { title: ev.map(x => x.title).join(", ") }) : null);
    if (items.length || ev.length) c.onclick = () => sheet(fmtDate(ds, { weekday: "long", day: "numeric", month: "long" }), [
      ev.length ? h("div.small.muted", { style: { marginBottom: "8px" } }, ev.map(x => "📌 " + x.title).join(" · ")) : null,
      items.length ? h("div.list", items.map(e => h("button.li" + (e.done || new Date(e.due_at) <= new Date() ? ".over" : ""), { type: "button", style: { textAlign: "left" }, onclick: () => { [...document.querySelectorAll(".backdrop")].pop()?.click(); setTimeout(() => openSheet(e), 240); } },
        h("div.ic", EXAM_KINDS[e.kind]?.[0] || "📌"), h("div.grow", h("b", { style: { textDecoration: e.done ? "line-through" : "" } }, e.title),
          h("div.small.muted", [shortKind(e), e.course, new Date(e.due_at).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Dhaka" })].filter(Boolean).join(" · ")))))) : null],
      { actions: close => [h("button.btn.block", { onclick: () => close() }, "Close")] });
    cells.push(c);
  }
  const monthName = new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const count = Object.values(byDay).flat().filter(e => !e.done).length;
  return h("div.card.cal",
    h("div.row.between", { style: { marginBottom: "8px" } },
      h("button.icon-btn", { type: "button", "aria-label": "Previous month", onclick: () => shift(-1) }, icon("back")),
      h("div.center", h("b", monthName), h("div.small.muted", count ? `${count} due this month` : "Nothing due")),
      h("button.icon-btn", { type: "button", "aria-label": "Next month", onclick: () => shift(1) }, icon("chev"))),
    h("div.cal-grid.cal-head", ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"].map(d => h("span", d))),
    h("div.cal-grid", cells),
    h("div.cal-legend", [["CT", "ct"], ["Lab", "lab"], ["Assign.", "assignment"], ["Exam", "exam"]].map(([l, k]) => h("span", h("i", { style: { background: KIND_COLOR[k] } }), l)), h("span", h("i.cal-ev-dot"), "Calendar")));
}
export const doneWord = k => ["lab", "assignment", "report", "paper", "result"].includes(k) ? "Submitted" : ["exam", "ct", "presentation"].includes(k) ? "Done" : "Done";
export async function markExamDone(e, done = true) {
  await api.update("exams", `id=eq.${e.id}`, { done });
  toast(done ? `${doneWord(e.kind)} ✓ — reminders stopped` : "Back on the list", "ok"); rerender();
}
export function examSheet(e) {
  const R = deadlines();
  let kind = e?.kind || R.kinds[0];
  const seg = h("div.row.wrap", { style: { gap: "6px" } });
  const drawSeg = () => seg.replaceChildren(...Object.entries(EXAM_KINDS).filter(([k]) => R.kinds.includes(k) || k === kind).map(([k, [ic, l]]) => h("button.chip" + (k === kind ? ".on" : ""), { type: "button", onclick: () => { kind = k; drawSeg(); } }, ic, " ", l)));
  drawSeg();
  const d0 = e ? new Date(new Date(e.due_at).getTime() + 6 * 3600e3) : null;
  const title = h("input.input", { value: e?.title || "", placeholder: R.eg, maxlength: "120" });
  const course = h("input.input", { value: e?.course || "", placeholder: "optional", maxlength: "60" });
  const date = h("input.input", { type: "date", value: d0 ? d0.toISOString().slice(0, 10) : addDays(todayStr(), 3) });
  const time = h("input.input", { type: "time", value: d0 ? `${pad(d0.getUTCHours())}:${pad(d0.getUTCMinutes())}` : "10:00" });
  const note = h("textarea.input", { placeholder: myRoles().some(k => ["student", "school"].includes(k)) ? "Syllabus, chapters… (optional)" : "Details (optional)", style: { minHeight: "56px" } }, e?.note || "");
  const got = h("input.input", { type: "number", inputmode: "decimal", min: "0", step: "0.25", placeholder: "e.g. 17", value: e?.marks_got ?? "" });
  const tot = h("input.input", { type: "number", inputmode: "decimal", min: "1", step: "0.25", placeholder: "e.g. 20", value: e?.marks_total ?? "" });
  sheet(e ? "Edit" : R.add, [
    h("label.f", h("span", "Type"), seg), h("label.f", h("span", "Title"), title), isStudy() ? h("label.f", h("span", myRoles()[0] === "teacher" ? "Class / subject" : "Course"), course) : h("label.f", h("span", "With / where (optional)"), course),
    h("div.grid2", h("label.f", h("span", "Due date"), date), h("label.f", h("span", "Time"), time)),
    h("label.f", h("span", "Notes"), note),
    e && isStudy() ? h("div.grid2", h("label.f", h("span", "Marks got"), got), h("label.f", h("span", "Out of"), tot)) : null], {
    actions: close => {
      const save = h("button.btn.primary", "Save");
      save.onclick = busy(save, async () => {
        if (!title.value.trim()) throw new Error("Write a title.");
        const due = new Date(`${date.value}T${time.value || "10:00"}:00+06:00`);
        if (!e && due < new Date()) throw new Error("Pick a time in the future.");
        const row = { kind, title: title.value.trim(), course: course.value.trim() || null, due_at: due.toISOString(), note: note.value.trim() || null };
        if (e && isStudy()) Object.assign(row, readMarks(got, tot));
        if (e) await api.update("exams", `id=eq.${e.id}`, row); else await api.insert("exams", { ...row, user_id: api.userId() });
        toast("Saved ✓ — reminders are set", "ok"); close(true); rerender();
      });
      const out = [h("button.btn", { onclick: () => close(null) }, "Cancel"), save];
      if (e) {
        const done = h("button.btn", e.done ? "Undo" : "✓ " + doneWord(e.kind));
        done.onclick = busy(done, async () => { close(true); await markExamDone(e, !e.done); });
        const del = h("button.btn.danger", { "aria-label": "Delete" }, icon("trash"));
        del.onclick = busy(del, async () => { if (!(await confirmBox("Delete?", e.title, "Delete", true))) return; await removeExamUndo(e); close(true); rerender(); });
        out.unshift(del, done);
      }
      return out;
    },
  });
}
