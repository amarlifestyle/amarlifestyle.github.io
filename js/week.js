// Amar Lifestyle — weekly planner: build your week like a neon routine chart
import * as api from "./api.js";
import { h, icon, t, toast, sheet, confirmBox, busy, todayStr, addDays, fmtTime, mins, durLabel, fmtDate, DAYS, dhakaIso, colorPicker, pad } from "./ui.js";
import { route, store, catColor, catNames, catDp, rerender } from "./app.js";
import { addTask } from "./today.js";
import { editRoutine } from "./more.js";
import { parseLine, micButton } from "./voice.js";
import { aiPlanSheet } from "./aicoach.js";

function weekStart(s) { const back = (new Date(s + "T00:00:00").getDay() + 1) % 7; return addDays(s, -back); } // week starts Saturday

route("week", async (page, offset = "0") => {
  const off = Number(offset) || 0;
  const today = todayStr();
  const ws = addDays(weekStart(today), off * 7), we = addDays(ws, 6);
  page.append(h("header.topbar",
    h("div", h("h1", t("Week")), h("div.sub", off === 0 ? "This week · " : off === 1 ? "Next week · " : "", `${fmtDate(ws)} – ${fmtDate(we)}`)),
    h("div.row", off !== 0 ? h("a.btn.small", { href: "#/week/0" }, "Today") : null,
      h("a.icon-btn", { href: `#/week/${off - 1}`, "aria-label": "Previous week" }, icon("back")),
      h("a.icon-btn", { href: `#/week/${off + 1}`, "aria-label": "Next week" }, icon("chev")))));
  if (we >= today) { try { await api.rpc("ensure_tasks", { p_from: ws < today ? today : ws, p_to: we }); } catch {} }
  const [tasks, routines, students] = await Promise.all([
    api.select("tasks", `select=*&day=gte.${ws}&day=lte.${we}&order=start_at`),
    api.select("routines", "select=*&active=eq.true"),
    api.select("students", "select=id,name,color&active=eq.true&order=name"),
  ]);
  const rMap = Object.fromEntries(routines.map(r => [r.id, r]));
  const sMap = Object.fromEntries(students.map(s => [s.id, s]));
  const colorOf = tk => tk.color || rMap[tk.routine_id]?.color || sMap[tk.student_id]?.color || catColor(tk.category);
  const ctx = { ws, we, today, students, routines };

  const days = [...Array(7)].map((_, i) => addDays(ws, i));
  const grid = h("div.week", days.map(d => {
    const list = tasks.filter(x => x.day === d && x.status !== "running");
    const dow = new Date(d + "T00:00:00").getDay();
    return h("div.wday",
      h("div.h" + (d === today ? ".today" : ""), DAYS[dow], h("small", fmtDate(d))),
      list.map(tk => {
        const st = ["completed", "late_completed"].includes(tk.status) ? ".done" : ["missed", "not_completed"].includes(tk.status) ? ".missed" : "";
        return h("div.cell" + st, { style: { "--c": colorOf(tk) }, role: "button", tabindex: "0", onclick: () => detail(tk, ctx) },
          fmtTime(tk.start_at).replace(":00", ""), " → ", tk.title,
          h("small", durLabel(mins(tk.start_at, tk.end_at)), tk.routine_id ? " · ↻" : ""));
      }),
      d >= today ? h("button.cell.add", { type: "button", onclick: () => planSheet(ctx, { days: [dow], day: d }), "aria-label": `Add on ${DAYS[dow]}` }, icon("plus"), "Add") : null);
  }));
  page.append(h("div.row.wrap", { style: { gap: "8px", marginBottom: "10px" } },
    h("button.btn.primary.small", { onclick: () => planSheet(ctx, {}) }, icon("plus"), "Add to week"),
    h("button.btn.small", { onclick: () => aiPlanSheet(ctx) }, "🤖 Build with AI"),
    h("button.btn.small", { onclick: () => planSheet(ctx, { voice: true }) }, icon("mic"), "Add by voice")));
  page.append(h("div.week-scroll", grid));
  page.append(h("p.small.faint", "↻ = repeats every week. Tap a box to edit or remove. ✓ = done, faded = missed."));

  const done = tasks.filter(x => ["completed", "late_completed"].includes(x.status));
  const byCat = {};
  done.forEach(x => byCat[x.category] = (byCat[x.category] || 0) + mins(x.start_at, x.end_at));
  const dp = tasks.reduce((s, x) => s + (x.dp_awarded || 0), 0);
  page.append(h("div.card.week-total", h("h3", "This week"),
    h("div.grid3", h("div.stat", h("div.k", "Tasks done"), h("div.v", `${done.filter(x => !x.is_timer).length}/${tasks.filter(x => !x.is_timer).length}`)),
      h("div.stat", h("div.k", "DP"), h("div.v", dp)), h("div.stat", h("div.k", "Hours"), h("div.v", (Object.values(byCat).reduce((a, b) => a + b, 0) / 60).toFixed(1)))),
    Object.keys(byCat).length ? h("div.mt", Object.entries(byCat).map(([c, m]) => h("div.row.between.small", { style: { padding: "3px 0" } },
      h("span", h("i", { style: { display: "inline-block", width: "10px", height: "10px", borderRadius: "3px", background: catColor(c), marginRight: "6px" } }), c), h("b", durLabel(m))))) : null));
  const img = h("button.btn.block", icon("download"), "Save chart as image");
  img.onclick = busy(img, async () => saveImage(days, tasks, colorOf, today));
  page.append(img);
}, { tab: "week" });

// ---------- add to week (typed, tapped or spoken)
export function planSheet(ctx, pre = {}) {
  const { ws, we, today, students } = ctx;
  const cats = catNames();
  const line = h("input.input", { placeholder: "Say or type: Sat 5 pm Leon tuition 1 hour every week" });
  const title = h("input.input", { placeholder: "e.g. C.P", maxlength: "80" });
  const cat = h("select.input", cats.map(n => h("option", { value: n }, `${n} · ${catDp(n)} DP/hour`)));
  const stu = h("select.input", h("option", { value: "" }, "— none —"), students.map(s => h("option", { value: s.id }, s.name)));
  const stuRow = h("label.f", h("span", "Student (attendance is added when you mark it Completed)"), stu);
  let days = [...(pre.days || [])];
  const dayBox = h("div.days");
  const drawDays = () => dayBox.replaceChildren(...[6, 0, 1, 2, 3, 4, 5].map(d => h("button" + (days.includes(d) ? ".on" : ""), { type: "button", onclick: () => { days = days.includes(d) ? days.filter(x => x !== d) : [...days, d]; drawDays(); } }, DAYS[d].slice(0, 2))));
  drawDays();
  const start = h("input.input", { type: "time", value: "17:00" });
  const dur = h("input.input", { type: "number", min: "5", max: "720", value: 60, inputmode: "numeric", "aria-label": "Minutes" });
  let color = "";
  const colors = colorPicker("", c => color = c, { allowNone: true });
  let repeat = "perm";
  const rep = h("div.seg", [["week", "Only this week"], ["perm", "Every week"]].map(([k, l]) => h("button" + (k === repeat ? ".on" : ""), { type: "button", "data-k": k, onclick: () => setRepeat(k) }, l)));
  const setRepeat = k => { repeat = k; rep.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.k === k)); };
  const showStu = () => { stuRow.style.display = cat.value === "Tuition" && students.length ? "" : "none"; };
  cat.onchange = showStu;
  stu.onchange = () => { const s = students.find(x => x.id === stu.value); if (s && !title.value.trim()) title.value = s.name; };
  showStu();

  const fill = text => {
    line.value = text;
    const p = parseLine(text, students, cats);
    if (p.days.length) { days = p.days; drawDays(); }
    if (p.time) start.value = p.time;
    if (p.duration) dur.value = p.duration;
    if (p.category && cats.includes(p.category)) cat.value = p.category;
    if (p.studentId) stu.value = p.studentId;
    if (p.title) title.value = p.title;
    if (p.repeat) setRepeat(p.repeat);
    showStu();
    toast(`Filled: ${days.map(d => DAYS[d]).join(", ") || "pick days"} · ${start.value} · ${durLabel(Number(dur.value))}. Check and Save.`);
  };
  const fillBtn = h("button.btn.small", { type: "button", onclick: () => line.value.trim() && fill(line.value) }, "Fill");

  return sheet("Add to week", [
    h("div.card", { style: { background: "var(--bg2)", marginBottom: "12px" } },
      h("div.row.between", h("b.small", "🎤 Quick add"), micButton(fill)),
      h("div.row.mt", h("div.grow", line), fillBtn),
      h("p.hint.mt.mb0", "Example: “শনি সোম বুধ বিকাল ৫টা Leon টিউশন ১ ঘণ্টা প্রতি সপ্তাহে”")),
    h("label.f", h("span", "What"), title),
    h("div.grid2", h("label.f", h("span", "Category"), cat), stuRow),
    h("label.f", h("span", "Days"), dayBox),
    h("div.grid2", h("label.f", h("span", "Start"), start), h("label.f", h("span", "Minutes"), dur)),
    h("label.f", h("span", "Colour"), colors),
    h("label.f", h("span", "Repeat"), rep),
  ], {
    actions: close => {
      const save = h("button.btn.primary", t("Save"));
      save.onclick = busy(save, async () => {
        const name = title.value.trim() || (students.find(s => s.id === stu.value)?.name) || cat.value;
        const m = Number(dur.value);
        if (!days.length) throw new Error("Pick at least one day.");
        if (!(m >= 5 && m <= 720)) throw new Error("Minutes must be 5 to 720.");
        const student = cat.value === "Tuition" ? stu.value || null : null;
        if (repeat === "perm") {
          const active = ctx.routines.find(r => r.active)?.template || "Normal";
          await api.insert("routines", { user_id: api.userId(), title: name, category: cat.value, start_time: start.value, duration_min: m, days, color: color || null, template: active, student_id: student, active: true });
          await api.rpc("ensure_tasks", { p_from: today, p_to: addDays(we < addDays(today, 7) ? addDays(today, 7) : we, 0) });
          toast(`Added to every ${days.map(d => DAYS[d]).join(", ")} ✓`, "ok");
        } else {
          let made = 0, skipped = 0;
          for (const d of days) {
            const date = [...Array(7)].map((_, i) => addDays(ws, i)).find(x => new Date(x + "T00:00:00").getDay() === d);
            const s = dhakaIso(date, start.value);
            if (date < today || new Date(s) < new Date(Date.now() - 60000)) { skipped++; continue; }
            const e = new Date(new Date(s).getTime() + m * 60000).toISOString();
            const r = await api.offlineSafe({ kind: "task", title: name, category: cat.value, start: s, end: e, studentId: student });
            if (color && r && !r.queued) await api.update("tasks", `id=eq.${r}`, { color });
            made++;
          }
          toast(made ? `Added for this week ✓${skipped ? ` (${skipped} past day skipped)` : ""}` : "Those times have already passed this week.", made ? "ok" : "bad");
        }
        close(true); rerender();
      });
      return [h("button.btn", { onclick: () => close(null) }, t("Cancel")), save];
    },
  }).then(() => {});
}

// ---------- tap a box
function detail(tk, ctx) {
  const st = { pending: "Not marked yet", completed: `Done · +${tk.dp_awarded} DP`, late_completed: "Done late · 0 DP", not_completed: `Not done · ${tk.dp_awarded} DP`, missed: `Missed · ${tk.dp_awarded} DP` }[tk.status] || tk.status;
  const routine = ctx.routines.find(r => r.id === tk.routine_id);
  const student = ctx.students.find(s => s.id === tk.student_id);
  const canChange = tk.status === "pending" && new Date(tk.end_at) > new Date();
  sheet(tk.title, h("div",
    h("p.muted.mb0", `${fmtDate(tk.day, { weekday: "long", day: "numeric", month: "short" })} · ${fmtTime(tk.start_at)} – ${fmtTime(tk.end_at)}`),
    h("p", h("b", tk.category), student ? ` · ${student.name}` : "", ` · ${tk.dp_value} DP`, routine ? " · ↻ every week" : " · this week only"),
    h("p.mb0", st)), {
    actions: close => {
      if (!canChange) return [h("button.btn", { onclick: () => close() }, "Close")];
      const editB = h("button.btn.small", icon("edit"), routine ? "Edit (every week)" : "Edit");
      editB.onclick = () => { close(); routine ? editRoutine(routine) : addTask(tk); };
      const rmWeek = h("button.btn.small", icon("trash"), routine ? "Remove this week" : "Remove");
      rmWeek.onclick = busy(rmWeek, async () => {
        if (routine) await api.insert("routine_skips", { routine_id: routine.id, day: tk.day, user_id: api.userId() });
        await api.remove("tasks", `id=eq.${tk.id}&status=eq.pending`);
        toast("Removed ✓", "ok"); close(); rerender();
      });
      const rmAll = routine ? h("button.btn.small.danger", icon("trash"), "Remove every week") : null;
      if (rmAll) rmAll.onclick = busy(rmAll, async () => {
        if (!(await confirmBox("Remove from every week?", `“${routine.title}” will stop repeating. Past days stay in your history.`, "Remove", true))) return;
        await api.remove("tasks", `routine_id=eq.${routine.id}&status=eq.pending&end_at=gt.${new Date().toISOString()}`);
        await api.update("routines", `id=eq.${routine.id}`, { active: false, template: "_removed" });
        toast("Removed from every week ✓", "ok"); close(); rerender();
      });
      return [h("div.row.wrap", { style: { gap: "6px", width: "100%" } }, editB, rmWeek, rmAll)];
    },
  });
}

// draws the neon week chart on a canvas and downloads it as PNG
async function saveImage(days, tasks, colorOf, today) {
  const colW = 230, rowH = 92, pad = 24, head = 90;
  const lists = days.map(d => tasks.filter(x => x.day === d && x.status !== "running"));
  const rows = Math.max(3, ...lists.map(l => l.length));
  const W = pad * 2 + colW * 7 + 14 * 6, H = head + pad + 70 + rows * (rowH + 14) + 60;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
  g.font = "700 34px Inter, sans-serif"; g.fillStyle = "#fff"; g.fillText("Amar Lifestyle · Week", pad, 52);
  g.font = "400 18px Inter, sans-serif"; g.fillStyle = "#9AA3B5"; g.fillText(`${fmtDate(days[0])} – ${fmtDate(days[6])} · ${store.profile?.name || ""}`, pad, 78);
  const box = (x, y, w, hh, col, fill) => {
    g.save(); g.shadowColor = col; g.shadowBlur = 16; g.strokeStyle = col; g.lineWidth = 3;
    g.beginPath(); g.roundRect(x, y, w, hh, 14); if (fill) { g.fillStyle = fill; g.fill(); } g.stroke(); g.restore();
  };
  days.forEach((d, i) => {
    const x = pad + i * (colW + 14);
    box(x, head + 10, colW, 60, d === today ? "#2DD4BF" : "#EF4444", "#140608");
    g.fillStyle = d === today ? "#2DD4BF" : "#F87171"; g.font = "700 30px Inter, sans-serif"; g.textAlign = "center";
    g.fillText(DAYS[new Date(d + "T00:00:00").getDay()], x + colW / 2, head + 52);
    for (let r = 0; r < rows; r++) {
      const y = head + 90 + r * (rowH + 14), tk = lists[i][r];
      if (!tk) { box(x, y, colW, rowH, "#3A3F4B", "#05060A"); g.fillStyle = "#555"; g.font = "600 26px Inter"; g.fillText("—", x + colW / 2, y + rowH / 2 + 9); continue; }
      const col = colorOf(tk);
      box(x, y, colW, rowH, col, "#05070C");
      g.fillStyle = col; g.font = "700 22px Inter, sans-serif";
      const line1 = `${fmtTime(tk.start_at).replace(":00", "")} → ${tk.title}`;
      g.fillText(line1.length > 18 ? line1.slice(0, 17) + "…" : line1, x + colW / 2, y + 42);
      g.font = "500 16px Inter, sans-serif"; g.fillStyle = "#C9D1DF";
      g.fillText(["completed", "late_completed"].includes(tk.status) ? "✓ done" : durLabel(mins(tk.start_at, tk.end_at)), x + colW / 2, y + 70);
    }
  });
  g.textAlign = "left";
  const a = document.createElement("a"); a.download = `amar-lifestyle-week-${days[0]}.png`; a.href = c.toDataURL("image/png"); a.click();
  toast("Chart saved ✓", "ok");
}
