// Amar Lifestyle — Syllabus: subjects → chapters. Tick a chapter with the day you finished it; see how much is done, per subject and per exam.
import * as api from "./api.js";
import { h, icon, toast, sheet, busy, confirmBox, todayStr, fmtDate, ring, PALETTE } from "./ui.js";
import { route, rerender } from "./app.js";

const pct = (a, b) => b ? Math.round(100 * a / b) : 0;
route("syllabus", async (page, examArg) => {
  const { routineTabsAsync } = await import("./timetable.js");
  page.append(h("header.topbar", h("div", h("h1", "Routine"), h("div.sub", "📚 Syllabus — কতটুকু শেষ হলো"))), await routineTabsAsync("syllabus"));
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
    h("a.chip" + (!ex ? ".on" : ""), { href: "#/syllabus" }, "সব"),
    exams.map(e => h("a.chip" + (ex?.id === e.id ? ".on" : ""), { href: `#/syllabus/${e.id}` }, "🎓 ", e.name, e.exam_date ? h("small", " · " + daysLeft(e.exam_date)) : null)),
    h("button.chip", { type: "button", onclick: () => examSheet(null, subs, chs) }, "＋ পরীক্ষা")));
  page.append(h("div.hero", ring(pct(doneN, all.length) / 100, pct(doneN, all.length) + "%", ""),
    h("div.grow", h("div", h("b.mid", `${doneN}/${all.length}`), h("span.small.muted", " চ্যাপ্টার শেষ")),
      h("div.small.muted", ex ? `${ex.name}${ex.exam_date ? " · " + fmtDate(ex.exam_date, { day: "numeric", month: "short" }) + " · " + daysLeft(ex.exam_date) : ""}` : "সব বিষয় মিলিয়ে"),
      ex ? h("button.linkbtn.small", { onclick: () => examSheet(ex, subs, chs) }, "✎ পরীক্ষা বদলান") : null)));
  if (!subs.length) {
    page.append(h("div.card.empty", h("p", "📚 প্রথমে একটা বিষয় যোগ করুন — যেমন Physics, তারপর তার চ্যাপ্টারগুলো।"), h("button.btn.primary", { onclick: () => subjectSheet() }, icon("plus"), "বিষয় যোগ করুন")));
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
          h("button.btn.small", { onclick: () => chapterSheet(s, null, exams, ex) }, icon("plus"), "চ্যাপ্টার"),
          h("button.btn.small.ghost", { onclick: () => subjectSheet(s) }, icon("edit"), "বিষয়"))));
    page.append(card);
  }
  page.append(h("button.btn.block.mt", { onclick: () => subjectSheet() }, icon("plus"), "নতুন বিষয়"));
  page.append(h("p.hint.mt", "চ্যাপ্টার শেষ হলে বৃত্তে টিক দিন — কোন দিন শেষ করলেন সেটা থাকবে। আবার পড়লে “রিভিশন” বাড়ান।"));
}, { tab: "week" });

const daysLeft = d => { const n = Math.round((new Date(d + "T00:00:00") - new Date(todayStr() + "T00:00:00")) / 864e5); return n < 0 ? "শেষ" : n === 0 ? "আজ" : `${n} দিন বাকি`; };
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
      h("div", c.title), h("div.small.muted", [c.done_on ? "✓ " + fmtDate(c.done_on, { day: "numeric", month: "short" }) : null, c.revised ? `রিভিশন ×${c.revised}` : null, names.length ? "🎓 " + names.join(", ") : null].filter(Boolean).join(" · "))));
}

function subjectSheet(s = null) {
  const name = h("input.input", { value: s?.name || "", placeholder: "যেমন: Physics 1st paper", maxlength: "80" });
  const many = h("textarea.input", { placeholder: "চ্যাপ্টারগুলো — প্রতি লাইনে একটা\nযেমন:\nভৌত জগৎ ও পরিমাপ\nভেক্টর\nগতিবিদ্যা", style: { minHeight: "110px" } });
  let color = s?.color || PALETTE[Math.floor(Math.random() * 8)];
  sheet(s ? "বিষয় বদলান" : "নতুন বিষয়", [h("label.f", h("span", "বিষয়ের নাম"), name), s ? null : h("label.f", h("span", "চ্যাপ্টার (ঐচ্ছিক)"), many)], {
    actions: close => {
      const save = h("button.btn.primary", "Save");
      save.onclick = busy(save, async () => {
        if (!name.value.trim()) throw new Error("বিষয়ের নাম দিন।");
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
      if (s) { const del = h("button.btn.danger", { "aria-label": "Delete" }, icon("trash")); del.onclick = busy(del, async () => { if (!(await confirmBox("বিষয়টা মুছবেন?", "এর সব চ্যাপ্টারও মুছে যাবে।", "Delete", true))) return; await api.remove("syl_subjects", `id=eq.${s.id}`); close(true); rerender(); }); out.unshift(del); }
      return out;
    },
  });
}

function chapterSheet(s, c, exams, ex = null) {
  const title = h("input.input", { value: c?.title || "", placeholder: "যেমন: Chapter 3 — গতিবিদ্যা", maxlength: "120" });
  let picked = new Set(c?.exam_ids || (ex ? [ex.id] : []));
  const exBox = h("div.row.wrap", { style: { gap: "6px" } });
  const draw = () => exBox.replaceChildren(...exams.map(e => h("button.chip" + (picked.has(e.id) ? ".on" : ""), { type: "button", onclick: () => { picked.has(e.id) ? picked.delete(e.id) : picked.add(e.id); draw(); } }, e.name)));
  draw();
  const done = h("input.input", { type: "date", value: c?.done_on || "", max: todayStr() });
  const rev = h("input.input", { type: "number", min: "0", max: "50", value: c?.revised || 0, inputmode: "numeric" });
  sheet(c ? "চ্যাপ্টার" : "নতুন চ্যাপ্টার", [h("label.f", h("span", "নাম"), title),
    exams.length ? h("label.f", h("span", "কোন পরীক্ষায় আছে"), exBox) : h("p.small.muted", "পরীক্ষা যোগ করলে এখানে বেছে নিতে পারবেন।"),
    c ? h("div.grid2", h("label.f", h("span", "শেষ করেছি (তারিখ)"), done), h("label.f", h("span", "কতবার রিভিশন"), rev)) : null], {
    actions: close => {
      const save = h("button.btn.primary", "Save");
      save.onclick = busy(save, async () => {
        if (!title.value.trim()) throw new Error("নাম দিন।");
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
  const name = h("input.input", { value: e?.name || "", placeholder: "যেমন: Mid-term, CT-2, HSC Test", maxlength: "80" });
  const date = h("input.input", { type: "date", value: e?.exam_date || "" });
  let picked = new Set(e ? chs.filter(c => c.exam_ids.includes(e.id)).map(c => c.id) : []);
  const list = h("div.syl-pick", subs.map(s => h("div", h("b.small", s.name), chs.filter(c => c.subject_id === s.id).map(c => {
    const cb = h("input", { type: "checkbox", checked: picked.has(c.id), onchange: ev => ev.target.checked ? picked.add(c.id) : picked.delete(c.id) });
    return h("label.check", cb, h("span", c.title));
  }))));
  sheet(e ? "পরীক্ষা বদলান" : "নতুন পরীক্ষা", [h("label.f", h("span", "পরীক্ষার নাম"), name), h("label.f", h("span", "তারিখ (ঐচ্ছিক)"), date),
    chs.length ? h("label.f", h("span", "কোন কোন চ্যাপ্টার আসবে"), list) : h("p.small.muted", "আগে বিষয় আর চ্যাপ্টার যোগ করুন, তারপর পরীক্ষার সাথে মেলান।")], {
    actions: close => {
      const save = h("button.btn.primary", "Save");
      save.onclick = busy(save, async () => {
        if (!name.value.trim()) throw new Error("পরীক্ষার নাম দিন।");
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
      if (e) { const del = h("button.btn.danger", { "aria-label": "Delete" }, icon("trash")); del.onclick = busy(del, async () => { if (!(await confirmBox("পরীক্ষাটা মুছবেন?", "চ্যাপ্টারগুলো থাকবে।", "Delete", true))) return; await api.remove("syl_exams", `id=eq.${e.id}`); close(true); location.hash = "#/syllabus"; }); out.unshift(del); }
      return out;
    },
  });
}
