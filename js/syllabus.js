// Amar Lifestyle — Syllabus: subjects → chapters. Tick a chapter with the day you finished it; see how much is done, per subject and per exam.
import * as api from "./api.js";
import { h, icon, toast, sheet, busy, confirmBox, todayStr, fmtDate, ring, PALETTE } from "./ui.js";
import { route, rerender } from "./app.js";

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
      ex ? h("button.linkbtn.small", { onclick: () => examSheet(ex, subs, chs) }, "Edit exam") : null)));
  if (!subs.length) {
    page.append(h("div.card.empty", h("p", "Add a subject, then its chapters."), h("button.btn.primary", { onclick: () => subjectSheet() }, icon("plus"), "Add subject")));
    return;
  }
  for (const s of subs) {
    const list = chs.filter(c => c.subject_id === s.id && inScope(c));
    if (ex && !list.length) continue;
    const d = list.filter(c => c.done_on).length;
    const card = h("details.syl" + (d === list.length && list.length ? ".full" : ""), { open: list.length <= 12, style: { "--c": s.color || "var(--brand)" } },
      h("summary", h("div.grow", h("b", s.name), h("div.syl-bar", h("i", { style: { width: pct(d, list.length) + "%" } }))), h("span.syl-p", `${pct(d, list.length)}%`), h("small.muted", ` ${d}/${list.length}`)),
      h("div.syl-list", list.map(c => chapterRow(c, exams)),
        h("div.row", { style: { gap: "6px", marginTop: "8px" } },
          h("button.btn.small", { onclick: () => chapterSheet(s, null, exams, ex) }, icon("plus"), "Chapter"),
          h("button.btn.small.ghost", { onclick: () => subjectSheet(s) }, icon("edit"), "Subject"))));
    page.append(card);
  }
  page.append(h("button.btn.block.mt", { onclick: () => subjectSheet() }, icon("plus"), "New subject"));
  page.append(h("p.hint.mt", "Tick a chapter when it's done."));
}, { tab: "week" });

const daysLeft = d => { const n = Math.round((new Date(d + "T00:00:00") - new Date(todayStr() + "T00:00:00")) / 864e5); return n < 0 ? "over" : n === 0 ? "today" : `${n} days left`; };
function chapterRow(c, exams) {
  const tick = h("button.syl-tick" + (c.done_on ? ".on" : ""), { type: "button", "aria-label": c.done_on ? "Not finished" : "Finished" }, c.done_on ? "✓" : "");
  tick.onclick = busy(tick, async () => {
    await api.update("syl_chapters", `id=eq.${c.id}`, { done_on: c.done_on ? null : todayStr() });
    if (!c.done_on && navigator.vibrate) navigator.vibrate(25);
    rerender();
  });
  const names = exams.filter(e => c.exam_ids.includes(e.id)).map(e => e.name);
  return h("div.syl-row" + (c.done_on ? ".done" : ""), tick,
    h("button.grow", { type: "button", onclick: () => chapterSheet(null, c, exams), style: { textAlign: "left", background: "none", border: 0, color: "inherit", font: "inherit", padding: 0, minWidth: 0 } },
      h("div", c.title), h("div.small.muted", [c.done_on ? "✓ " + fmtDate(c.done_on, { day: "numeric", month: "short" }) : null, c.revised ? `revised ×${c.revised}` : null, names.length ? "🎓 " + names.join(", ") : null].filter(Boolean).join(" · "))));
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
      if (s) { const del = h("button.btn.danger", { "aria-label": "Delete" }, icon("trash")); del.onclick = busy(del, async () => { if (!(await confirmBox("Delete subject?", "Its chapters are deleted too.", "Delete", true))) return; await api.remove("syl_subjects", `id=eq.${s.id}`); close(true); rerender(); }); out.unshift(del); }
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
  sheet(c ? "Chapter" : "New chapter", [h("label.f", h("span", "Name"), title),
    exams.length ? h("label.f", h("span", "In exams"), exBox) : h("p.small.muted", "Add an exam to link chapters."),
    c ? h("div.grid2", h("label.f", h("span", "Finished on"), done), h("label.f", h("span", "Revisions"), rev)) : null], {
    actions: close => {
      const save = h("button.btn.primary", "Save");
      save.onclick = busy(save, async () => {
        if (!title.value.trim()) throw new Error("Write a name.");
        const row = { title: title.value.trim(), exam_ids: [...picked] };
        if (c) await api.update("syl_chapters", `id=eq.${c.id}`, { ...row, done_on: done.value || null, revised: Math.max(0, Number(rev.value) || 0) });
        else await api.insert("syl_chapters", { ...row, user_id: api.userId(), subject_id: s.id, sort: 999 });
        close(true); rerender();
      });
      const out = [h("button.btn", { onclick: () => close(null) }, "Cancel"), save];
      if (c) { const del = h("button.btn.danger", { "aria-label": "Delete" }, icon("trash")); del.onclick = busy(del, async () => { await api.remove("syl_chapters", `id=eq.${c.id}`); close(true); rerender(); }); out.unshift(del); }
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
      if (e) { const del = h("button.btn.danger", { "aria-label": "Delete" }, icon("trash")); del.onclick = busy(del, async () => { if (!(await confirmBox("Delete exam?", "Chapters stay.", "Delete", true))) return; await api.remove("syl_exams", `id=eq.${e.id}`); close(true); location.hash = "#/syllabus"; }); out.unshift(del); }
      return out;
    },
  });
}
