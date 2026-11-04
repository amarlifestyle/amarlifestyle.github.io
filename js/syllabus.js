/* © 2026 Musfiqur Rahman. All rights reserved. Unauthorized copying is prohibited. Proprietary — see LICENSE. */
// Amar Lifestyle — Syllabus: subjects → chapters. Tick a chapter with the day you finished it; see how much is done, per subject and per exam.
import * as api from "./api.js";
import { h, icon, toast, sheet, busy, confirmBox, todayStr, fmtDate, ring, PALETTE, barChart, swipeAway } from "./ui.js";
import * as U from "./undo.js";
import { route, rerender } from "./app.js";

// remove with Undo: the rows are kept in memory and put back exactly if the user taps Undo
const strip = r => { const { created_at, ...x } = r; return x; };
export async function removeChapter(c) {
  await api.remove("syl_chapters", `id=eq.${c.id}`);
  U.record(`Chapter “${c.title}” removed`, () => api.insert("syl_chapters", strip(c)), () => api.remove("syl_chapters", `id=eq.${c.id}`));
}
export async function removeSubject(sb, chs) {
  const mine = chs.filter(c => c.subject_id === sb.id);
  await api.remove("syl_subjects", `id=eq.${sb.id}`);
  U.record(`Subject “${sb.name}” removed`, async () => { await api.insert("syl_subjects", strip(sb)); if (mine.length) await api.insert("syl_chapters", mine.map(strip)); }, () => api.remove("syl_subjects", `id=eq.${sb.id}`));
}
export async function removeExam(e, chs) {
  const linked = chs.filter(c => (c.exam_ids || []).includes(e.id));
  await api.remove("syl_exams", `id=eq.${e.id}`);
  U.record(`Exam “${e.name}” removed`, async () => { await api.insert("syl_exams", strip(e)); for (const c of linked) await api.update("syl_chapters", `id=eq.${c.id}`, { exam_ids: c.exam_ids }); }, () => api.remove("syl_exams", `id=eq.${e.id}`));
}
const pct = (a, b) => b ? Math.round(100 * a / b) : 0;
route("syllabus", async (page, examArg) => {
  const { routineTabsAsync } = await import("./timetable.js");
  page.append(h("header.topbar", h("div", h("h1", "Routine"), h("div.sub", "📚 Syllabus"))), await routineTabsAsync("syllabus"));
  const [subs, exams, chs] = await Promise.all([
    api.select("syl_subjects", "select=*&order=sort,created_at"),
    api.select("syl_exams", "select=*&order=exam_date.nullslast,created_at"),
    api.select("syl_chapters", "select=*&order=sort,created_at"),
  ]);
  const ex = exams.find(e => e.id === examArg) || null;
  const inScope = c => !ex || c.exam_ids.includes(ex.id);
  const all = chs.filter(inScope), doneN = all.filter(c => c.done_on).length;
  // exam filter
  page.append(h("div.row.wrap", { style: { gap: "6px", marginBottom: "10px" } },
    h("a.chip" + (!ex ? ".on" : ""), { href: "#/syllabus" }, "All"),
    exams.map(e => h("a.chip" + (ex?.id === e.id ? ".on" : ""), { href: `#/syllabus/${e.id}` }, "🎓 ", e.name, e.exam_date ? h("small", " · " + daysLeft(e.exam_date)) : null)),
    h("button.chip", { type: "button", onclick: () => examSheet(null, subs, chs) }, "＋ Exam")));
  page.append(h("div.hero", ring(pct(doneN, all.length) / 100, pct(doneN, all.length) + "%", ""),
    h("div.grow", h("div", h("b.mid", `${doneN}/${all.length}`), h("span.small.muted", " chapters done")),
      h("div.small.muted", ex ? `${ex.name}${ex.exam_date ? " · " + fmtDate(ex.exam_date, { day: "numeric", month: "short" }) + " · " + daysLeft(ex.exam_date) : ""}` : "All subjects"),
      ex ? h("div.row", { style: { gap: "14px" } }, h("button.linkbtn.small", { onclick: () => examSheet(ex, subs, chs) }, "Edit exam"),
        (() => { const b = h("button.linkbtn.small", { style: { color: "var(--red)" } }, "Remove exam"); b.onclick = busy(b, async () => { if (!(await confirmBox("Remove exam?", ex.name + " — chapters stay.", "Remove", true))) return; await removeExam(ex, chs); location.hash = "#/syllabus"; }); return b; })()) : null)));
  // revise today: chapters finished 3, 7 or 30 days ago
  const tday = todayStr(), back = n => { const d = new Date(tday + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  const due = chs.filter(c => c.done_on && [3, 7, 30].some(n => c.done_on === back(n)));
  if (due.length) page.append(h("div.card.revise", h("h3", "📚 Revise today"), h("div.list", due.map(c => {
    const b = h("button.btn.small", "✓ Revised");
    b.onclick = busy(b, async () => { await api.update("syl_chapters", `id=eq.${c.id}`, { revised: (c.revised || 0) + 1 }); toast("Nice ✓", "ok"); rerender(); });
    return h("div.li", h("div.grow", h("b", c.title), h("div.small.muted", subs.find(s => s.id === c.subject_id)?.name || "")), b);
  }))));
  // study hours by subject (last 7 days) — only finished study tasks whose name really names the subject:
  // the course code (e.g. "PHY 105" = "phy105") or the whole subject name. Tuition / teaching tasks never count.
  if (subs.length) {
    const tasks = await api.select("tasks", `select=title,category,start_at,end_at,status,done_pct&day=gte.${back(6)}&status=in.(completed,late_completed)`).catch(() => []);
    const flat = x => String(x || "").toLowerCase().replace(/[^a-z0-9ঀ-৿]+/g, "");
    const STUDY = /study|class|skill|learning|reading|lab/i;
    const studyTasks = tasks.filter(t => STUDY.test(t.category || "") && !/tuition|teach/i.test(t.category || ""));
    const keysOf = sb => {
      const full = flat(sb.name);
      const codes = (String(sb.name).match(/[A-Za-z]{2,5}\s*-?\s*\d{3}/g) || []).map(flat); // PHY 105, IRE-101, PROG102
      return [...new Set([...codes, full.length >= 4 ? full : null].filter(Boolean))];
    };
    const hrs = subs.map(sb => {
      const keys = keysOf(sb);
      const m = studyTasks.filter(t => keys.some(k => flat(t.title).includes(k))).reduce((a, t) => a + (new Date(t.end_at) - new Date(t.start_at)) / 36e5 * (t.done_pct || 100) / 100, 0);
      return { l: sb.name.length > 10 ? sb.name.slice(0, 9) + "…" : sb.name, v: +m.toFixed(1), c: sb.color };
    });
    if (hrs.some(x => x.v > 0)) page.append(h("div.card", h("h3", "Study hours — last 7 days"),
      h("p.small.muted.keep", { style: { margin: "-4px 0 8px" } }, "From finished study tasks whose name has the subject code or name (e.g. “PHY 105 revision”)."),
      barChart(hrs, { fmt: v => v + "h" })));
  }
  // classes in the routine that aren't subjects yet → one tap to add them all
  const classes = await api.select("timetable_items", "select=title,code&kind=eq.university&mine=eq.true").catch(() => []);
  const have = new Set(subs.map(x => x.name.trim().toLowerCase()));
  const fresh = [...new Set(classes.map(c => (c.title || "").trim()).filter(Boolean))].filter(t => !have.has(t.toLowerCase()));
  const fromClasses = fresh.length ? (() => {
    const b = h("button.btn" + (subs.length ? ".block" : ".primary.block"), icon("plus"), `Add my ${fresh.length} class${fresh.length > 1 ? "es" : ""} as subjects`);
    b.onclick = busy(b, async () => {
      const r = await api.insert("syl_subjects", fresh.map((name, i) => ({ user_id: api.userId(), name: name.slice(0, 80), color: PALETTE[(subs.length + i) % PALETTE.length], sort: subs.length + i })));
      const ids = (Array.isArray(r) ? r : [r]).map(x => x?.id).filter(Boolean);
      U.record(`${fresh.length} subject(s) added`, () => ids.length && api.remove("syl_subjects", `id=in.(${ids.join(",")})`), () => {});
      toast("Added ✓ — now add chapters to each", "ok"); rerender();
    });
    return h("div", { style: { margin: "0 0 12px" } }, b, h("div.small.muted", { style: { marginTop: "6px" } }, fresh.join(" · ")));
  })() : null;
  if (!subs.length) {
    page.append(h("div.card.empty", h("p", "Add a subject, then its chapters."), fromClasses, h("button.btn" + (fresh.length ? "" : ".primary"), { onclick: () => subjectSheet() }, icon("plus"), "Add subject")));
    return;
  }
  for (const s of subs) {
    const list = chs.filter(c => c.subject_id === s.id && inScope(c));
    if (ex && !list.length) continue;
    const d = list.filter(c => c.done_on).length;
    const card = h("details.syl" + (d === list.length && list.length ? ".full" : ""), { open: list.length <= 12, style: { "--c": s.color || "var(--brand)" } },
      h("summary", h("div.grow", h("b", s.name), h("div.syl-bar", h("i", { style: { width: pct(d, list.length) + "%" } }))), h("span.syl-p", `${pct(d, list.length)}%`), h("small.muted", ` ${d}/${list.length}`)),
      h("div.syl-list", list.map((c, i) => chapterRow(c, exams, ex ? null : list, i)),
        h("div.row.wrap", { style: { gap: "6px", marginTop: "8px" } },
          h("button.btn.small", { onclick: () => chapterSheet(s, null, exams, ex) }, icon("plus"), "Chapter"),
          h("button.btn.small.ghost", { onclick: () => import("./assistant.js").then(m => m.askSheet({ photo: true, text: `এই ছবি (বইয়ের সূচিপত্র বা সিলেবাস) থেকে "${s.name}" সাবজেক্টের সব চ্যাপ্টার ক্রমানুসারে যোগ করো` })) }, icon("camera"), "From photo"),
          !ex && list.length > 1 ? h("button.btn.small.ghost" + (reorderSub === s.id ? ".on" : ""), { onclick: () => { reorderSub = reorderSub === s.id ? null : s.id; rerender(); } }, reorderSub === s.id ? "✓ Done" : "↕ Reorder") : null,
          h("button.btn.small.ghost", { onclick: () => subjectSheet(s) }, icon("edit"), "Rename"),
          (() => { const b = h("button.btn.small.ghost.syl-del", { "aria-label": "Remove subject" }, icon("trash"), "Remove"); b.onclick = busy(b, async () => { if (!(await confirmBox("Remove subject?", `${s.name} and its ${chs.filter(c => c.subject_id === s.id).length} chapter(s). You can Undo.`, "Remove", true))) return; await removeSubject(s, chs); rerender(); }); return b; })())));
    page.append(card);
  }
  page.append(h("button.btn.block.mt", { onclick: () => subjectSheet() }, icon("plus"), "New subject"));
  if (fromClasses) page.append(h("div.mt", fromClasses));
  page.append(h("p.hint.keep.small.muted.mt", "Tick a chapter when it's done · swipe left or ✕ to remove (Undo shows below)."));
}, { tab: "week" });

const daysLeft = d => { const n = Math.round((new Date(d + "T00:00:00") - new Date(todayStr() + "T00:00:00")) / 864e5); return n < 0 ? "over" : n === 0 ? "today" : `${n} days left`; };
const STAR = n => n > 0 ? h("span.syl-star", "★".repeat(n)) : null;
let reorderSub = null; // subject id whose chapters show ↑ ↓
async function moveChapter(list, i, dir) {
  const j = i + dir; if (j < 0 || j >= list.length) return;
  const arr = [...list]; [arr[i], arr[j]] = [arr[j], arr[i]];
  await Promise.all(arr.map((c, k) => c.sort === k ? null : api.update("syl_chapters", `id=eq.${c.id}`, { sort: k })).filter(Boolean));
  rerender();
}
function chapterRow(c, exams, list = null, idx = 0) {
  const tick = h("button.syl-tick" + (c.done_on ? ".on" : ""), { type: "button", "aria-label": c.done_on ? "Not finished" : "Finished" }, c.done_on ? "✓" : "");
  tick.onclick = busy(tick, async () => {
    await api.update("syl_chapters", `id=eq.${c.id}`, { done_on: c.done_on ? null : todayStr() });
    if (!c.done_on && navigator.vibrate) navigator.vibrate(25);
    rerender();
  });
  const names = exams.filter(e => c.exam_ids.includes(e.id)).map(e => e.name);
  const gone = async () => { await removeChapter(c); rerender(); };
  const x = h("button.s-x", { type: "button", "aria-label": "Remove chapter" }, "✕");
  x.onclick = busy(x, gone);
  const ordering = list && reorderSub === c.subject_id;
  const arrows = ordering ? h("div.syl-move",
    h("button.icon-btn", { type: "button", "aria-label": "Move up", disabled: idx === 0, onclick: e => { e.currentTarget.disabled = true; moveChapter(list, idx, -1).catch(er => toast(er.message, "bad")); } }, "↑"),
    h("button.icon-btn", { type: "button", "aria-label": "Move down", disabled: idx === list.length - 1, onclick: e => { e.currentTarget.disabled = true; moveChapter(list, idx, 1).catch(er => toast(er.message, "bad")); } }, "↓")) : null;
  const row = h("div.syl-row" + (c.done_on ? ".done" : ""), ordering ? null : tick,
    h("button.grow", { type: "button", onclick: () => !ordering && chapterSheet(null, c, exams), style: { textAlign: "left", background: "none", border: 0, color: "inherit", font: "inherit", padding: 0, minWidth: 0 } },
      h("div", STAR(c.stars), c.title),
      c.note ? h("div.small.syl-note", c.note) : null,
      h("div.small.muted", [c.done_on ? "✓ " + fmtDate(c.done_on, { day: "numeric", month: "short" }) : null, c.revised ? `revised ×${c.revised}` : null, names.length ? "🎓 " + names.join(", ") : null].filter(Boolean).join(" · "))),
    ordering ? arrows : x);
  if (!ordering) swipeAway(row, gone);
  return row;
}

function subjectSheet(s = null) {
  const name = h("input.input", { value: s?.name || "", placeholder: "e.g. Physics 1st paper", maxlength: "80" });
  const many = h("textarea.input", { placeholder: "Chapters — one per line\ne.g.\nUnits & measurement\nVectors\nMotion", style: { minHeight: "110px" } });
  let color = s?.color || PALETTE[Math.floor(Math.random() * 8)];
  sheet(s ? "Edit subject" : "New subject", [h("label.f", h("span", "Subject name"), name), s ? null : h("label.f", h("span", "Chapters (optional)"), many)], {
    actions: close => {
      const save = h("button.btn.primary", "Save");
      save.onclick = busy(save, async () => {
        if (!name.value.trim()) throw new Error("Write a subject name.");
        if (s) await api.update("syl_subjects", `id=eq.${s.id}`, { name: name.value.trim() });
        else {
          const r = await api.insert("syl_subjects", { user_id: api.userId(), name: name.value.trim(), color });
          const sid = (Array.isArray(r) ? r[0] : r)?.id;
          const lines = many.value.split("\n").map(x => x.trim()).filter(Boolean).slice(0, 80);
          if (sid && lines.length) await api.insert("syl_chapters", lines.map((t, i) => ({ user_id: api.userId(), subject_id: sid, title: t.slice(0, 120), sort: i })));
        }
        toast("Saved ✓", "ok"); close(true); rerender();
      });
      const out = [h("button.btn", { onclick: () => close(null) }, "Cancel"), save];
      if (s) { const del = h("button.btn.danger", { "aria-label": "Delete" }, icon("trash")); del.onclick = busy(del, async () => { if (!(await confirmBox("Delete subject?", "Its chapters are deleted too.", "Delete", true))) return; const all = await api.select("syl_chapters", `select=*&subject_id=eq.${s.id}`).catch(() => []); await removeSubject(s, all); close(true); rerender(); }); out.unshift(del); }
      return out;
    },
  });
}

function chapterSheet(s, c, exams, ex = null) {
  const title = h("input.input", { value: c?.title || "", placeholder: "e.g. Chapter 3 — Motion", maxlength: "120" });
  let picked = new Set(c?.exam_ids || (ex ? [ex.id] : []));
  const exBox = h("div.row.wrap", { style: { gap: "6px" } });
  const draw = () => exBox.replaceChildren(...exams.map(e => h("button.chip" + (picked.has(e.id) ? ".on" : ""), { type: "button", onclick: () => { picked.has(e.id) ? picked.delete(e.id) : picked.add(e.id); draw(); } }, e.name)));
  draw();
  const done = h("input.input", { type: "date", value: c?.done_on || "", max: todayStr() });
  const rev = h("input.input", { type: "number", min: "0", max: "50", value: c?.revised || 0, inputmode: "numeric" });
  let stars = c?.stars || 0;
  const starBox = h("div.row", { style: { gap: "6px" } });
  const drawStars = () => starBox.replaceChildren(...[0, 1, 2, 3].map(n => h("button.chip" + (stars === n ? ".on" : ""), { type: "button", onclick: () => { stars = n; drawStars(); } }, n ? "★".repeat(n) : "None")));
  drawStars();
  const note = h("textarea.input", { placeholder: "Note — e.g. formulas, important for CT, page 45–60", maxlength: "500", style: { minHeight: "64px" } }); note.value = c?.note || "";
  sheet(c ? "Chapter" : "New chapter", [h("label.f", h("span", "Name"), title),
    h("label.f", h("span", "Importance"), starBox),
    h("label.f", h("span", "Note"), note),
    exams.length ? h("label.f", h("span", "In exams"), exBox) : h("p.small.muted", "Add an exam to link chapters."),
    c ? h("div.grid2", h("label.f", h("span", "Finished on"), done), h("label.f", h("span", "Revisions"), rev)) : null], {
    actions: close => {
      const save = h("button.btn.primary", "Save");
      save.onclick = busy(save, async () => {
        if (!title.value.trim()) throw new Error("Write a name.");
        const row = { title: title.value.trim(), exam_ids: [...picked], stars, note: note.value.trim() || null };
        if (c) await api.update("syl_chapters", `id=eq.${c.id}`, { ...row, done_on: done.value || null, revised: Math.max(0, Number(rev.value) || 0) });
        else await api.insert("syl_chapters", { ...row, user_id: api.userId(), subject_id: s.id, sort: 999 });
        close(true); rerender();
      });
      const out = [h("button.btn", { onclick: () => close(null) }, "Cancel"), save];
      if (c) { const del = h("button.btn.danger", { "aria-label": "Delete" }, icon("trash")); del.onclick = busy(del, async () => { await removeChapter(c); close(true); rerender(); }); out.unshift(del); }
      return out;
    },
  });
}

function examSheet(e, subs, chs) {
  const name = h("input.input", { value: e?.name || "", placeholder: "e.g. Mid-term, CT-2", maxlength: "80" });
  const date = h("input.input", { type: "date", value: e?.exam_date || "" });
  let picked = new Set(e ? chs.filter(c => c.exam_ids.includes(e.id)).map(c => c.id) : []);
  const list = h("div.syl-pick", subs.map(s => h("div", h("b.small", s.name), chs.filter(c => c.subject_id === s.id).map(c => {
    const cb = h("input", { type: "checkbox", checked: picked.has(c.id), onchange: ev => ev.target.checked ? picked.add(c.id) : picked.delete(c.id) });
    return h("label.check", cb, h("span", c.title));
  }))));
  sheet(e ? "Edit exam" : "New exam", [h("label.f", h("span", "Exam name"), name), h("label.f", h("span", "Date (optional)"), date),
    chs.length ? h("label.f", h("span", "Chapters in this exam"), list) : h("p.small.muted", "Add subjects and chapters first.")], {
    actions: close => {
      const save = h("button.btn.primary", "Save");
      save.onclick = busy(save, async () => {
        if (!name.value.trim()) throw new Error("Write the exam name.");
        let id = e?.id;
        if (e) await api.update("syl_exams", `id=eq.${e.id}`, { name: name.value.trim(), exam_date: date.value || null });
        else { const r = await api.insert("syl_exams", { user_id: api.userId(), name: name.value.trim(), exam_date: date.value || null }); id = (Array.isArray(r) ? r[0] : r)?.id; }
        if (id) for (const c of chs) {
          const has = c.exam_ids.includes(id), want = picked.has(c.id);
          if (has !== want) await api.update("syl_chapters", `id=eq.${c.id}`, { exam_ids: want ? [...c.exam_ids, id] : c.exam_ids.filter(x => x !== id) });
        }
        toast("Saved ✓", "ok"); close(true); location.hash = `#/syllabus/${id}`; rerender();
      });
      const out = [h("button.btn", { onclick: () => close(null) }, "Cancel"), save];
      if (e) { const del = h("button.btn.danger", { "aria-label": "Delete" }, icon("trash")); del.onclick = busy(del, async () => { if (!(await confirmBox("Delete exam?", "Chapters stay.", "Delete", true))) return; await removeExam(e, chs); close(true); location.hash = "#/syllabus"; }); out.unshift(del); }
      return out;
    },
  });
}
