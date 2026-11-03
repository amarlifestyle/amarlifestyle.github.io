// Amar Lifestyle — undo / redo for routine and task changes (deleted by mistake? bring it back)
import * as api from "./api.js";
import { h, toast } from "./ui.js";

const done = [], undone = [];
let listeners = [];
const changed = () => listeners.forEach(f => f());
export const onChange = f => { listeners = [...listeners.filter(x => x.isConnected !== false), f]; };
export const canUndo = () => done.length > 0, canRedo = () => undone.length > 0;

// record a change: label (Bangla), undo() and redo() put things back / do it again
export function record(label, undo, redo) {
  done.push({ label, undo, redo }); if (done.length > 30) done.shift();
  undone.length = 0; changed();
  showBar(label);
}
let bar = null, barT = 0;
function showBar(label) {
  bar?.remove(); clearTimeout(barT);
  const b = h("button.undo-btn", { type: "button" }, "↶ Undo");
  bar = h("div.undo-bar", h("span", label), b);
  b.onclick = async () => { bar?.remove(); await undo(); };
  document.body.append(bar);
  barT = setTimeout(() => { bar?.classList.add("out"); setTimeout(() => bar?.remove(), 300); }, 7000);
}
async function run(op, fn, msg) {
  try { await fn(); await api.rpc("ensure_tasks", { p_from: todayIso(), p_to: plus7() }).catch(() => {}); toast(msg + " ✓", "ok"); }
  catch (e) { toast(e.message || "Couldn't do that", "bad"); return false; }
  const { rerender } = await import("./app.js"); rerender(); return true;
}
export async function undo() {
  const op = done.pop(); if (!op) return toast("Nothing to undo");
  if (await run(op, op.undo, "Restored: " + op.label)) undone.push(op); else done.push(op);
  changed();
}
export async function redo() {
  const op = undone.pop(); if (!op) return toast("Nothing to redo");
  if (await run(op, op.redo, "Redone: " + op.label)) done.push(op); else undone.push(op);
  changed();
}
const todayIso = () => { const d = new Date(Date.now() + 6 * 3600e3); return d.toISOString().slice(0, 10); };
const plus7 = () => { const d = new Date(Date.now() + 6 * 3600e3 + 7 * 864e5); return d.toISOString().slice(0, 10); };

// two small buttons for a page header
export function undoButtons() {
  const u = h("button.icon-btn.undo-ic", { type: "button", "aria-label": "Undo", title: "Undo", onclick: () => undo() }, "↶");
  const r = h("button.icon-btn.undo-ic", { type: "button", "aria-label": "Redo", title: "Redo", onclick: () => redo() }, "↷");
  const sync = () => { u.disabled = !canUndo(); r.disabled = !canRedo(); };
  sync(); onChange(sync);
  return h("div.row", { style: { gap: "6px" } }, u, r);
}

// ready-made undo for the common changes
const skipDel = (rid, day) => api.remove("routine_skips", `routine_id=eq.${rid}&day=eq.${day}`);
export function removedTask(tk) { // a task removed from one day
  record(`“${tk.title}” removed`,
    async () => {
      if (tk.routine_id) { await skipDel(tk.routine_id, tk.day); return; } // the routine makes it again
      await api.rpc("add_task", { p_title: tk.title, p_category: tk.category, p_start: tk.start_at, p_end: tk.end_at, p_student: tk.student_id || null });
    },
    async () => {
      if (tk.routine_id) await api.insert("routine_skips", { routine_id: tk.routine_id, day: tk.day, user_id: api.userId() }).catch(() => {});
      await api.remove("tasks", `${tk.routine_id ? `routine_id=eq.${tk.routine_id}&day=eq.${tk.day}` : `title=eq.${encodeURIComponent(tk.title)}&start_at=eq.${encodeURIComponent(tk.start_at)}`}&status=eq.pending`);
    });
}
export function changedRoutine(label, before, after, id) { // routine row: before/after fields
  const apply = async fields => {
    await api.update("routines", `id=eq.${id}`, fields);
    await api.remove("tasks", `routine_id=eq.${id}&status=eq.pending&start_at=gt.${new Date().toISOString()}`);
  };
  record(label, () => apply(before), () => apply(after));
}
export function movedTasks(label, moves) { // [{ id, from: [s, e], to: [s, e] }]
  const set = k => Promise.all(moves.map(m => api.update("tasks", `id=eq.${m.id}&status=eq.pending`, { start_at: m[k][0], end_at: m[k][1] })));
  record(label, () => set("from"), () => set("to"));
}
