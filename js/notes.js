/* © 2026 Musfiqur Rahman. All rights reserved. Unauthorized copying is prohibited. Proprietary — see LICENSE. */
// Amar Lifestyle — Notes: quick important things for today; kept by day, reminded until done or removed.
import * as api from "./api.js";
import { h, icon, toast, busy, todayStr, fmtDate, swipeAway } from "./ui.js";
import { route, rerender, backbar } from "./app.js";

function row(n, after) {
  const tick = h("button.note-tick" + (n.done ? ".on" : ""), { type: "button", "aria-label": n.done ? "Not done" : "Done" }, n.done ? "✓" : "");
  tick.onclick = busy(tick, async () => { await api.update("notes", `id=eq.${n.id}`, { done: !n.done, done_at: n.done ? null : new Date().toISOString() }); after(); });
  const del = h("button.s-x", { type: "button", "aria-label": "Remove" }, "✕");
  const remove = async () => { await api.remove("notes", `id=eq.${n.id}`).catch(e => toast(e.message, "bad")); after(); };
  del.onclick = busy(del, remove);
  const el = h("div.note" + (n.done ? ".done" : ""), tick, h("div.note-t", n.text), del);
  swipeAway(el, remove);
  return el;
}
function adder(day, after) {
  const inp = h("input.input.note-in", { placeholder: "Add a note…", maxlength: "500", enterkeyhint: "done" });
  const add = async () => {
    const t = inp.value.trim(); if (!t) return;
    inp.value = "";
    try { await api.insert("notes", { user_id: api.userId(), text: t, day }); after(); } catch (e) { inp.value = t; toast(e.message, "bad"); }
  };
  inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); add(); } });
  // speak a note: words appear in the box, then tap ＋
  const mic = h("button.icon-btn", { type: "button", "aria-label": "Speak a note" }, icon("mic"));
  let dict = null;
  mic.onclick = async () => {
    if (!dict) { const { dictation } = await import("./voice.js"); dict = dictation(inp, { transcribe: audio => api.ai("transcribe", { audio }), label: "Speak your note" }); dict.classList.add("note-dict"); wrap.after(dict); }
    dict.querySelector(".dict-main")?.click();
  };
  const wrap = h("div.note-add", inp, mic, h("button.icon-btn", { type: "button", "aria-label": "Add note", onclick: add }, icon("plus")));
  return wrap;
}

// the 📝 button at the top opens this: today's notes, add by typing / voice / AI, and the history
export async function openNotes() {
  const { sheet } = await import("./ui.js");
  const day = todayStr();
  const list = h("div.note-list");
  const draw = async () => {
    let rows = [];
    try { rows = await api.select("notes", `select=*&day=eq.${day}&order=sort,created_at`); } catch { /* offline */ }
    list.replaceChildren(rows.length ? rows.map(n => row(n, draw)) : h("p.small.muted", { style: { margin: "6px 2px" } }, "Nothing noted today."));
    refreshNotesBadge();
  };
  await draw();
  sheet("📝 Notes", [list, adder(day, draw),
    h("div.row", { style: { gap: "8px", marginTop: "12px" } },
      h("a.btn.small.grow", { href: "#/notes", onclick: () => document.querySelector(".backdrop")?.click() }, icon("history"), "History"),
      h("button.btn.small.grow", { type: "button", onclick: () => { document.querySelector(".backdrop")?.click(); setTimeout(() => import("./assistant.js").then(m => m.askSheet({ text: "নোট করে রাখো: " })), 260); } }, "✨ Note with AI"))],
    { actions: close => [h("button.btn.block", { onclick: () => close() }, "Done")] });
}
// open notes count on the 📝 button
export async function refreshNotesBadge() {
  try {
    const n = (await api.select("notes", `select=id&day=eq.${todayStr()}&done=eq.false&limit=20`)).length;
    document.querySelectorAll(".top-notes").forEach(b => { b.querySelector(".nav-badge")?.remove(); if (n) b.append(h("i.nav-badge.soft", String(n))); });
  } catch { /* offline */ }
}

// Today: today's notes, always open for a quick add
export async function notesCard() {
  const day = todayStr();
  const box = h("div.card.notes");
  const draw = async () => {
    let list = [], older = 0;
    try {
      list = await api.select("notes", `select=*&day=eq.${day}&order=sort,created_at`);
      older = (await api.select("notes", `select=id&day=lt.${day}&done=eq.false&limit=50`)).length;
    } catch { /* offline */ }
    box.replaceChildren(
      h("div.row.between", h("h3.mb0", "📝 Notes"), h("a.small", { href: "#/notes" }, older ? `${older} older open →` : "History →")),
      list.length ? h("div.note-list", list.map(n => row(n, draw))) : null,
      adder(day, draw));
  };
  await draw();
  return box;
}

// all notes, day by day
route("notes", async page => {
  page.append(backbar("Notes", "#/today"));
  const draw = async () => {
    const all = await api.select("notes", "select=*&order=day.desc,sort,created_at&limit=500");
    const open = all.filter(n => !n.done && n.day < todayStr());
    const body = h("div");
    body.append(h("div.card.notes", h("h3", "Today"), h("div.note-list", all.filter(n => n.day === todayStr()).map(n => row(n, draw))), adder(todayStr(), draw)));
    if (open.length) body.append(h("div.section-title", h("h2", "Still open")), h("div.card.notes", h("div.note-list", open.map(n => h("div", h("div.small.muted", fmtDate(n.day, { weekday: "short", day: "numeric", month: "short" })), row(n, draw))))));
    const days = [...new Set(all.filter(n => n.day < todayStr()).map(n => n.day))];
    days.forEach(d => body.append(h("div.section-title", h("h2", fmtDate(d, { weekday: "long", day: "numeric", month: "short" }))), h("div.card.notes", h("div.note-list", all.filter(n => n.day === d).map(n => row(n, draw))))));
    if (!all.length) body.append(h("div.card.empty", h("p", "No notes yet.")));
    page.querySelector(".notes-body")?.replaceWith(body); body.className = "notes-body";
  };
  page.append(h("div.notes-body"));
  await draw();
}, { tab: "today" });
