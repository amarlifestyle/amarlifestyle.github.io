// Amar Lifestyle — Exams: class tests, lab reports, assignments. Reminders get more frequent as the day comes.
import * as api from "./api.js";
import { h, icon, toast, sheet, busy, confirmBox, todayStr, addDays, fmtDate, pad } from "./ui.js";
import { route, rerender } from "./app.js";

export const EXAM_KINDS = { ct: ["📝", "CT"], lab: ["🧪", "Lab report"], assignment: ["📄", "Assignment"], exam: ["🎓", "Exam"], other: ["📌", "Other"] };
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
  try { return await api.select("exams", `select=*&done=eq.false&due_at=gt.${new Date().toISOString()}&due_at=lt.${new Date(Date.now() + days * 864e5).toISOString()}&order=due_at`); } catch { return []; }
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
  const { routineTabsAsync } = await import("./timetable.js");
  page.append(h("header.topbar", h("div", h("h1", "Routine"), h("div.sub", "CT, lab reports & exams"))), await routineTabsAsync("exams"));
  const all = await api.select("exams", "select=*&order=due_at");
  const now = Date.now();
  const open = all.filter(e => !e.done && new Date(e.due_at) > now), past = all.filter(e => e.done || new Date(e.due_at) <= now).reverse().slice(0, 15);
  page.append(h("button.btn.primary.block", { onclick: () => examSheet() }, icon("plus"), "Add CT / lab report / exam"));
  const row = e => h("button.li", { onclick: () => examSheet(e), style: { textAlign: "left", opacity: e.done ? .6 : 1 } },
    h("div.ic", EXAM_KINDS[e.kind][0]),
    h("div.grow", { style: { minWidth: 0 } }, h("b", { style: { textDecoration: e.done ? "line-through" : "" } }, e.title), h("div.small.muted", [EXAM_KINDS[e.kind][1], e.course, when(e.due_at)].filter(Boolean).join(" · "))),
    e.done ? h("span.badge.ok", "Done") : h("span.small", { style: { color: urgency(e.due_at), fontWeight: 600, whiteSpace: "nowrap" } }, leftLabel(e.due_at)));
  page.append(h("div.section-title", h("h2", "Coming up")));
  page.append(open.length ? h("div.list", open.map(row)) : h("div.card.empty", h("p", "Nothing due. Add your next CT or lab report.")));
  page.append(h("p.hint.mt", "Reminders: daily → twice a day in the last week → 3 times in the last 3 days → every 3 hours in the last 2 days → every 2 hours on the last day → every hour in the last 3 hours."));
  if (past.length) page.append(h("div.section-title", h("h2", "Done & past")), h("div.list", past.map(row)));
}, { tab: "week" });

function examSheet(e) {
  let kind = e?.kind || "ct";
  const seg = h("div.row.wrap", { style: { gap: "6px" } });
  const drawSeg = () => seg.replaceChildren(...Object.entries(EXAM_KINDS).map(([k, [ic, l]]) => h("button.chip" + (k === kind ? ".on" : ""), { type: "button", onclick: () => { kind = k; drawSeg(); } }, ic, " ", l)));
  drawSeg();
  const d0 = e ? new Date(new Date(e.due_at).getTime() + 6 * 3600e3) : null;
  const title = h("input.input", { value: e?.title || "", placeholder: "e.g. CT-2: Kinematics", maxlength: "120" });
  const course = h("input.input", { value: e?.course || "", placeholder: "e.g. PHY 101 (optional)", maxlength: "60" });
  const date = h("input.input", { type: "date", value: d0 ? d0.toISOString().slice(0, 10) : addDays(todayStr(), 3) });
  const time = h("input.input", { type: "time", value: d0 ? `${pad(d0.getUTCHours())}:${pad(d0.getUTCMinutes())}` : "10:00" });
  const note = h("textarea.input", { placeholder: "Syllabus, chapters… (optional)", style: { minHeight: "56px" } }, e?.note || "");
  sheet(e ? "Edit" : "Add CT / lab report / exam", [
    h("label.f", h("span", "Type"), seg), h("label.f", h("span", "Title"), title), h("label.f", h("span", "Course"), course),
    h("div.grid2", h("label.f", h("span", "Due date"), date), h("label.f", h("span", "Time"), time)),
    h("label.f", h("span", "Notes"), note)], {
    actions: close => {
      const save = h("button.btn.primary", "Save");
      save.onclick = busy(save, async () => {
        if (!title.value.trim()) throw new Error("Write a title.");
        const due = new Date(`${date.value}T${time.value || "10:00"}:00+06:00`);
        if (!e && due < new Date()) throw new Error("Pick a time in the future.");
        const row = { kind, title: title.value.trim(), course: course.value.trim() || null, due_at: due.toISOString(), note: note.value.trim() || null };
        if (e) await api.update("exams", `id=eq.${e.id}`, row); else await api.insert("exams", { ...row, user_id: api.userId() });
        toast("Saved ✓ — reminders are set", "ok"); close(true); rerender();
      });
      const out = [h("button.btn", { onclick: () => close(null) }, "Cancel"), save];
      if (e) {
        const done = h("button.btn", e.done ? "Not done" : "✓ Done");
        done.onclick = busy(done, async () => { await api.update("exams", `id=eq.${e.id}`, { done: !e.done }); toast(e.done ? "Marked not done" : "Done ✓ — reminders stopped", "ok"); close(true); rerender(); });
        const del = h("button.btn.danger", { "aria-label": "Delete" }, icon("trash"));
        del.onclick = busy(del, async () => { if (!(await confirmBox("Delete?", e.title, "Delete", true))) return; await api.remove("exams", `id=eq.${e.id}`); close(true); rerender(); });
        out.unshift(del, done);
      }
      return out;
    },
  });
}
