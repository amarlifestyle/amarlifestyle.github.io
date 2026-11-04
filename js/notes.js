/* © 2026 Musfiqur Rahman. All rights reserved. Unauthorized copying is prohibited. Proprietary — see LICENSE. */
// Amar Lifestyle — Notes: quick important things for today; kept by day, reminded until done or removed.
import * as api from "./api.js";
import { h, icon, toast, busy, todayStr, fmtDate, swipeAway } from "./ui.js";
import { route, rerender, backbar } from "./app.js";

// one note line. Ticking it done moves it to History (it leaves the open list); ✕ removes it, with Undo.
function row(n, after, { history = false, dateLabel = null } = {}) {
  const tick = h("button.note-tick" + (n.done ? ".on" : ""), { type: "button", "aria-label": n.done ? "Not done" : "Done" }, n.done ? "✓" : "");
  const el = h("div.note" + (n.done ? ".done" : ""));
  const leave = () => new Promise(r => { el.classList.add("note-out"); setTimeout(r, 260); });
  tick.onclick = busy(tick, async () => {
    const done = !n.done;
    await api.update("notes", `id=eq.${n.id}`, { done, done_at: done ? new Date().toISOString() : null });
    if (!history) await leave();
    import("./undo.js").then(U => U.record(done ? "Note done — moved to History" : "Note open again",
      () => api.update("notes", `id=eq.${n.id}`, { done: !done, done_at: done ? null : new Date().toISOString() }).then(after),
      () => api.update("notes", `id=eq.${n.id}`, { done, done_at: done ? new Date().toISOString() : null }).then(after)));
    after();
  });
  const del = h("button.s-x", { type: "button", "aria-label": "Remove" }, "✕");
  const remove = async () => {
    try { await api.remove("notes", `id=eq.${n.id}`); } catch (e) { toast(e.message, "bad"); return; }
    const { created_at, ...back } = n;
    import("./undo.js").then(U => U.record("Note removed", () => api.insert("notes", back).then(after), () => api.remove("notes", `id=eq.${n.id}`).then(after)));
    after();
  };
  del.onclick = busy(del, async () => { await leave(); await remove(); });
  el.dataset.id = n.id; el.dataset.sort = n.sort ?? 0;
  const grip = n.done ? null : h("span.note-grip", { "aria-label": "Drag to move", title: "Hold and drag to move" }, "⋮⋮");
  if (grip) dragSort(grip, el, after);
  el.append(...[grip, tick, h("div.note-t", n.text, history && n.done && n.done_at ? h("div.small.muted", "✓ " + fmtDate(n.done_at.slice(0, 10), { day: "numeric", month: "short" })) : dateLabel ? h("div.small.muted", dateLabel) : null), del].filter(Boolean));
  swipeAway(el, remove);
  return el;
}

// hold ⋮⋮ and drag a note up or down; the new order is saved for that list
function dragSort(grip, el, after) {
  grip.style.touchAction = "none";
  grip.addEventListener("pointerdown", e => {
    e.preventDefault(); e.stopPropagation();
    const list = el.parentElement; if (!list) return;
    const y0 = e.clientY; let base = y0;
    el.classList.add("dragging"); grip.setPointerCapture?.(e.pointerId);
    navigator.vibrate?.(10);
    const move = ev => {
      let dy = ev.clientY - base;
      el.style.transform = `translateY(${dy}px)`;
      const prev = el.previousElementSibling, next = el.nextElementSibling;
      if (dy < 0 && prev?.classList.contains("note") && ev.clientY < prev.getBoundingClientRect().top + prev.offsetHeight / 2) {
        list.insertBefore(el, prev); base -= prev.offsetHeight; dy = ev.clientY - base; el.style.transform = `translateY(${dy}px)`;
      } else if (dy > 0 && next?.classList.contains("note") && ev.clientY > next.getBoundingClientRect().top + next.offsetHeight / 2) {
        list.insertBefore(next, el); base += next.offsetHeight; dy = ev.clientY - base; el.style.transform = `translateY(${dy}px)`;
      }
    };
    const up = async () => {
      grip.removeEventListener("pointermove", move); grip.removeEventListener("pointerup", up); grip.removeEventListener("pointercancel", up);
      el.classList.remove("dragging"); el.style.transform = "";
      const rows = [...list.children].filter(x => x.classList.contains("note") && x.dataset.id);
      const changes = rows.map((x, i) => [x.dataset.id, i, Number(x.dataset.sort)]).filter(([, i, old]) => i !== old);
      if (!changes.length) return;
      try { await Promise.all(changes.map(([id, i]) => api.update("notes", `id=eq.${id}`, { sort: i }))); rows.forEach((x, i) => { x.dataset.sort = i; }); }
      catch (er) { toast(er.message, "bad"); after(); }
    };
    grip.addEventListener("pointermove", move); grip.addEventListener("pointerup", up); grip.addEventListener("pointercancel", up);
  });
}
function adder(day, after) {
  const inp = h("input.input.note-in", { placeholder: "Add a note…", maxlength: "500", enterkeyhint: "done" });
  const add = async () => {
    const t = inp.value.trim(); if (!t) return;
    inp.value = "";
    try { await api.insert("notes", { user_id: api.userId(), text: t, day, sort: 999 }); after(); } catch (e) { inp.value = t; toast(e.message, "bad"); }
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
    try { rows = await api.select("notes", `select=*&done=eq.false&day=lte.${day}&order=sort,day.desc,created_at&limit=60`); } catch { /* offline */ }
    list.replaceChildren(rows.length ? rows.map(n => row(n, draw, { dateLabel: n.day === day ? null : "from " + fmtDate(n.day, { weekday: "short", day: "numeric", month: "short" }) }))
      : h("p.small.muted", { style: { margin: "6px 2px" } }, "No open notes. Done notes are in History."));
    refreshNotesBadge();
  };
  await draw();
  sheet("📝 Notes", [list, adder(day, draw),
    h("div.row", { style: { gap: "8px", marginTop: "12px" } },
      h("a.btn.small.grow", { href: "#/notes", onclick: () => [...document.querySelectorAll(".backdrop")].pop()?.click() }, icon("history"), "History"),
      h("button.btn.small.grow", { type: "button", onclick: () => { [...document.querySelectorAll(".backdrop")].pop()?.click(); setTimeout(() => import("./assistant.js").then(m => m.askSheet({ text: "নোট করে রাখো: " })), 260); } }, "✨ Note with AI"))],
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
      list = await api.select("notes", `select=*&day=eq.${day}&done=eq.false&order=sort,created_at`);
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

// History: open notes first, then every done note by the day it was done
route("notes", async page => {
  page.append(backbar("Notes", "#/today"));
  const draw = async () => {
    const all = await api.select("notes", "select=*&order=day.desc,sort,created_at&limit=800");
    const today = todayStr();
    const open = all.filter(n => !n.done).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || b.day.localeCompare(a.day)), done = all.filter(n => n.done);
    const body = h("div");
    body.append(h("div.card.notes", h("h3", "Open"),
      open.length ? h("div.note-list", open.map(n => row(n, draw, { dateLabel: n.day !== today ? "from " + fmtDate(n.day, { weekday: "short", day: "numeric", month: "short" }) : null }))) : h("p.small.muted.keep", "Nothing open."),
      adder(today, draw)));
    const doneDay = n => (n.done_at ? new Date(new Date(n.done_at).getTime() + 6 * 3600e3).toISOString().slice(0, 10) : n.day);
    const days = [...new Set(done.map(doneDay))].sort().reverse();
    if (days.length) body.append(h("div.section-title", h("h2", `Done · ${done.length}`)));
    days.forEach(d => body.append(h("div.small.muted", { style: { margin: "10px 4px 4px", fontWeight: 600 } }, d === today ? "Today" : fmtDate(d, { weekday: "long", day: "numeric", month: "short" })),
      h("div.card.notes", h("div.note-list", done.filter(n => doneDay(n) === d).map(n => row(n, draw, { history: true }))))));
    if (!all.length) body.append(h("div.card.empty", h("p", "No notes yet.")));
    page.querySelector(".notes-body")?.replaceWith(body); body.className = "notes-body";
    refreshNotesBadge();
  };
  page.append(h("div.notes-body"));
  await draw();
}, { tab: "today" });
