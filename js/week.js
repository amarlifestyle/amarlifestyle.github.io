// Amar Lifestyle — weekly planner: build your week like a neon routine chart
import * as api from "./api.js";
import * as U from "./undo.js";
import { timePicker, nowHM } from "./timepick.js";
import { pickColor } from "./ui.js";
import { h, icon, t, toast, sheet, confirmBox, busy, todayStr, addDays, fmtTime, mins, durLabel, fmtDate, DAYS, dhakaIso, colorPicker, pad } from "./ui.js";
import { route, store, catColor, catNames, catDp, rerender } from "./app.js";
import { addTask, editChoice } from "./today.js";
import { editRoutine } from "./more.js";
import { aiPlanSheet } from "./aicoach.js";
import { routineTabsAsync } from "./timetable.js";

function weekStart(s) { const back = (new Date(s + "T00:00:00").getDay() + 1) % 7; return addDays(s, -back); } // week starts Saturday

route("week", async (page, offset = "0") => {
  const off = Number(offset) || 0;
  const today = todayStr();
  const ws = addDays(weekStart(today), off * 7), we = addDays(ws, 6);
  page.append(h("header.topbar",
    h("div", h("h1", "Routine"), h("div.sub", off === 0 ? "This week · " : off === 1 ? "Next week · " : "", `${fmtDate(ws)} – ${fmtDate(we)}`)),
    h("div.row", off !== 0 ? h("a.btn.small", { href: "#/week/0" }, "Today") : null,
      h("a.icon-btn", { href: `#/week/${off - 1}`, "aria-label": "Previous week" }, icon("back")),
      h("a.icon-btn", { href: `#/week/${off + 1}`, "aria-label": "Next week" }, icon("chev")))));
  page.append(await routineTabsAsync("week"));
  page.append(h("div.row.between", { style: { margin: "-4px 0 8px" } }, h("span.small.muted", off === 0 ? "এই সপ্তাহ" : ""), U.undoButtons()));
  if (we >= today) { try { await api.rpc("ensure_tasks", { p_from: ws < today ? today : ws, p_to: we }); } catch {} }
  const [tasks0, routines, students] = await Promise.all([
    api.select("tasks", `select=*&day=gte.${ws}&day=lte.${we}&order=start_at`),
    api.select("routines", "select=*&active=eq.true"),
    api.select("students", "select=id,name,color&active=eq.true&order=name"),
  ]);
  // a day with no tasks yet (e.g. a day before the routine was made) shows the weekly routine itself
  const fromRoutine = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(ws, i), dow = new Date(d + "T00:00:00").getDay();
    if (tasks0.some(t => t.day === d)) continue;
    routines.filter(r => r.days.includes(dow) && r.template !== "_removed" && (!r.starts_on || r.starts_on <= d || d < today)).forEach(r => {
      const s0 = dhakaIso(d, r.start_time.slice(0, 5));
      fromRoutine.push({ id: `r:${r.id}:${d}`, isPlan: true, routine_id: r.id, student_id: r.student_id, title: r.title, category: r.category, day: d, start_at: s0, end_at: new Date(new Date(s0).getTime() + r.duration_min * 60000).toISOString(), status: "plan", color: r.color, dp_value: 0 });
    });
  }
  const tasks = [...tasks0, ...fromRoutine].sort((a, b) => a.start_at.localeCompare(b.start_at));
  const rMap = Object.fromEntries(routines.map(r => [r.id, r]));
  const sMap = Object.fromEntries(students.map(s => [s.id, s]));
  const colorOf = tk => tk.color || rMap[tk.routine_id]?.color || sMap[tk.student_id]?.color || catColor(tk.category);
  const ctx = { ws, we, today, students, routines };

  const days = [...Array(7)].map((_, i) => addDays(ws, i));
  let zoom = Math.min(2, Math.max(0, Number(api.LS.get("al_week_zoom", 0)) || 0));
  const grid = h("div.week.z" + zoom, days.map(d => {
    const list = tasks.filter(x => x.day === d && x.status !== "running");
    const dow = new Date(d + "T00:00:00").getDay();
    return h("div.wday" + (d < today ? ".past" : ""),
      h("div.h" + (d === today ? ".today" : ""), DAYS[dow], h("small", d < today ? "শেষ" : fmtDate(d))),
      list.map(tk => {
        const st = ["completed", "late_completed"].includes(tk.status) ? ".done" : ["missed", "not_completed"].includes(tk.status) ? ".missed" : "";
        return h("div.cell" + st, { style: { "--c": colorOf(tk) }, role: "button", tabindex: "0", onclick: () => detail(tk, ctx, list) },
          h("span.tm", fmtTime(tk.start_at).replace(":00", "")), h("span.arr", " → "), h("span.tt", tk.title),
          h("small", durLabel(mins(tk.start_at, tk.end_at)), tk.routine_id ? " · ↻" : ""));
      }),
      d >= today ? h("button.cell.add", { type: "button", onclick: () => planSheet(ctx, { days: [dow], day: d }), "aria-label": `Add on ${DAYS[dow]}` }, icon("plus"), "Add") : null);
  }));
  page.append(h("div.row.wrap", { style: { gap: "8px", marginBottom: "10px" } },
    h("button.btn.primary.small", { onclick: () => planSheet(ctx, {}) }, icon("plus"), "Add to week"),
    h("button.btn.small", { onclick: () => aiPlanSheet(ctx) }, icon("mic"), "Build with AI"),
    h("a.btn.small", { href: "#/routine" }, icon("routine"), "Repeating tasks")));
  const scroller = h("div.week-scroll", grid);
  const zl = h("span.small.muted");
  const setZoom = z => {
    zoom = Math.min(2, Math.max(0, z)); api.LS.set("al_week_zoom", zoom);
    grid.className = "week z" + zoom; zl.textContent = ["7 days fit", "Medium", "Big"][zoom];
    zIn.disabled = zoom === 2; zOut.disabled = zoom === 0;
    const t = scroller.querySelector(".wday .h.today")?.parentElement;
    scroller.scrollLeft = zoom && t ? Math.max(0, t.offsetLeft - 10) : 0;
  };
  const zOut = h("button.btn.small", { "aria-label": "Zoom out", onclick: () => setZoom(zoom - 1) }, "−");
  const zIn = h("button.btn.small", { "aria-label": "Zoom in", onclick: () => setZoom(zoom + 1) }, "＋");
  // two-finger pinch on the chart also zooms
  let pinch = null;
  const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  scroller.addEventListener("touchstart", e => { if (e.touches.length === 2) pinch = dist(e.touches); }, { passive: true });
  scroller.addEventListener("touchmove", e => {
    if (!pinch || e.touches.length !== 2) return;
    const r = dist(e.touches) / pinch;
    if (r > 1.3) { setZoom(zoom + 1); pinch = dist(e.touches); } else if (r < 0.77) { setZoom(zoom - 1); pinch = dist(e.touches); }
  }, { passive: true });
  scroller.addEventListener("touchend", () => { pinch = null; }, { passive: true });
  page.append(h("div.zoombar", zl, zOut, zIn), scroller);
  setTimeout(() => setZoom(zoom), 0);
  page.append(h("p.small.faint", "↻ = repeats every week. Tap a box to edit or remove. ✓ = done, faded = missed."));

  const done = tasks.filter(x => ["completed", "late_completed"].includes(x.status));
  const byCat = {};
  done.forEach(x => byCat[x.category] = (byCat[x.category] || 0) + mins(x.start_at, x.end_at));
  const dp = tasks.reduce((s, x) => s + (x.dp_awarded || 0), 0);
  page.append(h("div.card.week-total", h("h3", "This week"),
    h("div.grid3", h("div.stat", h("div.k", "Tasks done"), h("div.v", `${done.filter(x => !x.is_timer).length}/${tasks.filter(x => !x.is_timer && !x.isPlan).length}`)),
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
  const title = h("input.input", { placeholder: "e.g. C.P", maxlength: "80" });
  const cat = h("select.input", cats.map(n => h("option", { value: n }, `${n} · ${catDp(n)} DP/hour`)));
  const stu = h("select.input", h("option", { value: "" }, "— none —"), students.map(s => h("option", { value: s.id }, s.name)));
  const stuRow = h("label.f", h("span", "Student (attendance is added when you mark it Completed)"), stu);
  let days = [...(pre.days || [])];
  const dayBox = h("div.days");
  const drawDays = () => dayBox.replaceChildren(...[6, 0, 1, 2, 3, 4, 5].map(d => h("button" + (days.includes(d) ? ".on" : ""), { type: "button", onclick: () => { days = days.includes(d) ? days.filter(x => x !== d) : [...days, d]; drawDays(); } }, DAYS[d].slice(0, 2))));
  drawDays();
  const tp = timePicker({ start: pre.day && pre.day > today ? "17:00" : nowHM(), minutes: 60 });
  let color = "";
  const colors = colorPicker("", c => color = c, { allowNone: true });
  let repeat = pre.repeat || "week"; // a task added on a day is for this week only, unless you choose Every week
  const rep = h("div.seg", [["week", "Only this week"], ["perm", "Every week"]].map(([k, l]) => h("button" + (k === repeat ? ".on" : ""), { type: "button", "data-k": k, onclick: () => setRepeat(k) }, l)));
  const setRepeat = k => { repeat = k; rep.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.k === k)); };
  const showStu = () => { stuRow.style.display = cat.value === "Tuition" && students.length ? "" : "none"; };
  cat.onchange = showStu;
  stu.onchange = () => { const s = students.find(x => x.id === stu.value); if (s && !title.value.trim()) title.value = s.name; };
  showStu();

  return sheet("Add to week", [
    h("label.f", h("span", "What"), title),
    h("div.grid2", h("label.f", h("span", "Category"), cat), stuRow),
    h("label.f", h("span", "Days"), dayBox),
    h("div.f", tp.el),
    h("label.f", h("span", "Colour"), colors),
    h("label.f", h("span", "Repeat"), rep),
  ], {
    actions: close => {
      const save = h("button.btn.primary", t("Save"));
      save.onclick = busy(save, async () => {
        const name = title.value.trim() || (students.find(s => s.id === stu.value)?.name) || cat.value;
        const { start: stHM, minutes: m } = tp.get(); const start = { value: stHM };
        if (!days.length) throw new Error("Pick at least one day.");
        if (!(m >= 5 && m <= 720)) throw new Error("Minutes must be 5 to 720.");
        const student = cat.value === "Tuition" ? stu.value || null : null;
        if (repeat === "perm") {
          const active = ctx.routines.find(r => r.active)?.template || "Normal";
          await api.insert("routines", { user_id: api.userId(), title: name, category: cat.value, start_time: start.value, duration_min: m, days, color: color || pickColor(name, ctx.routines), template: active, student_id: student, active: true });
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
            const col = color || pickColor(name, ctx.routines);
            if (r && !r.queued) await api.update("tasks", `id=eq.${r}`, { color: col });
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
function detail(tk, ctx, dayList = []) {
  if (tk.isPlan) { const r = ctx.routines.find(x => x.id === tk.routine_id); if (r) editRoutine(r); return; }
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
      const editB = h("button.btn.small", icon("edit"), "Edit");
      editB.onclick = () => { close(); setTimeout(() => routine ? editChoice(tk, ctx.routines) : addTask(tk), 230); };
      const rmWeek = h("button.btn.small", icon("trash"), routine ? "Remove this week" : "Remove");
      rmWeek.onclick = busy(rmWeek, async () => {
        if (routine) await api.insert("routine_skips", { routine_id: routine.id, day: tk.day, user_id: api.userId() });
        await api.remove("tasks", `id=eq.${tk.id}&status=eq.pending`);
        U.removedTask(tk); close(); rerender();
      });
      const dow = new Date(tk.day + "T00:00:00").getDay(), dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dow];
      const others = routine ? routine.days.filter(d => d !== dow) : [];
      const rmAll = routine ? h("button.btn.small.danger", icon("trash"), `Remove every ${dayName}`) : null;
      if (rmAll) rmAll.onclick = busy(rmAll, async () => {
        if (!(await confirmBox(`Remove from every ${dayName}?`, others.length ? `“${routine.title}” stays on the other days (${others.map(d => DAYS[d]).join(", ")}). Past days stay in your history.` : `“${routine.title}” will stop repeating. Past days stay in your history.`, "Remove", true))) return;
        // remove only this weekday's upcoming copies (today's one too, if it hasn't been marked)
        const pend = await api.select("tasks", `select=id,day&routine_id=eq.${routine.id}&status=eq.pending&end_at=gt.${new Date().toISOString()}`);
        const ids = pend.filter(x => new Date(x.day + "T00:00:00").getDay() === dow).map(x => x.id);
        if (ids.length) await api.remove("tasks", `id=in.(${ids.join(",")})&status=eq.pending`);
        const after = others.length ? { days: others } : { active: false, template: "_removed" };
        await api.update("routines", `id=eq.${routine.id}`, after);
        U.changedRoutine(`“${routine.title}” প্রতি ${dayName} থেকে সরানো`, { days: routine.days, active: true, template: routine.template }, after, routine.id);
        close(); rerender();
      });
      const mv = new Date(tk.start_at) > new Date() ? h("button.btn.small", "↕ Move") : null;
      if (mv) mv.onclick = () => { close(); moveSheet(tk, ctx, dayList); };
      return [h("div.row.wrap", { style: { gap: "6px", width: "100%" } }, mv, editB, rmWeek, rmAll)];
    },
  });
}

// draws the neon week chart on a canvas and downloads it as PNG
async function saveImage(days, tasks, colorOf, today) {
  try { await document.fonts?.ready; } catch { /* fine */ }
  const S = 2; // draw at 2x so it stays sharp
  const FONT = '-apple-system, "SF Pro Text", "Segoe UI", Roboto, "Noto Sans Bengali", "Hind Siliguri", sans-serif';
  const colW = 250, rowH = 110, gap = 16, pad = 32, head = 110;
  const lists = days.map(d => tasks.filter(x => x.day === d && x.status !== "running"));
  const rows = Math.max(3, ...lists.map(l => l.length));
  const W = pad * 2 + colW * 7 + gap * 6, H = head + 80 + rows * (rowH + gap) + pad;
  const c = document.createElement("canvas"); c.width = W * S; c.height = H * S;
  const g = c.getContext("2d"); g.scale(S, S); g.textBaseline = "middle";
  g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
  g.textAlign = "left";
  g.font = `700 36px ${FONT}`; g.fillStyle = "#fff"; g.fillText("Amar Lifestyle · Week", pad, 48);
  g.font = `400 20px ${FONT}`; g.fillStyle = "#9AA3B5"; g.fillText(`${fmtDate(days[0])} – ${fmtDate(days[6])} · ${store.profile?.name || ""}`, pad, 84);
  const box = (x, y, w, hh, col, fill) => {
    g.save(); g.shadowColor = col; g.shadowBlur = 14; g.strokeStyle = col; g.lineWidth = 3;
    g.beginPath(); (g.roundRect ? g.roundRect(x, y, w, hh, 14) : g.rect(x, y, w, hh)); if (fill) { g.fillStyle = fill; g.fill(); } g.stroke(); g.restore();
  };
  // biggest font (max..min) that fits the width; still too long → cut with …
  const fit = (text, maxW, weight, max, min) => {
    let size = max; g.font = `${weight} ${size}px ${FONT}`;
    while (size > min && g.measureText(text).width > maxW) { size--; g.font = `${weight} ${size}px ${FONT}`; }
    let t = text; while (g.measureText(t).width > maxW && t.length > 2) t = t.slice(0, -2) + "…";
    return t;
  };
  g.textAlign = "center";
  days.forEach((d, i) => {
    const x = pad + i * (colW + gap), cx = x + colW / 2, isToday = d === today;
    box(x, head, colW, 64, isToday ? "#2DD4BF" : "#EF4444", "#140608");
    g.fillStyle = isToday ? "#2DD4BF" : "#F87171";
    g.fillText(fit(DAYS[new Date(d + "T00:00:00").getDay()], colW - 24, 700, 32, 18), cx, head + 32);
    for (let r = 0; r < rows; r++) {
      const y = head + 80 + r * (rowH + gap), tk = lists[i][r];
      if (!tk) { box(x, y, colW, rowH, "#3A3F4B", "#05060A"); g.fillStyle = "#555"; g.font = `600 28px ${FONT}`; g.fillText("—", cx, y + rowH / 2); continue; }
      const col = colorOf(tk), done = ["completed", "late_completed"].includes(tk.status), missed = ["missed", "not_completed"].includes(tk.status);
      box(x, y, colW, rowH, col, "#05070C");
      g.globalAlpha = missed ? 0.45 : 1;
      g.fillStyle = col;
      g.fillText(fit(fmtTime(tk.start_at).replace(":00", ""), colW - 28, 700, 26, 16), cx, y + 30);
      g.fillText(fit(tk.title, colW - 28, 700, 26, 15), cx, y + 62);
      g.fillStyle = "#C9D1DF";
      g.fillText(fit((done ? "✓ done · " : missed ? "✗ missed · " : "") + durLabel(mins(tk.start_at, tk.end_at)), colW - 28, 500, 17, 12), cx, y + 92);
      g.globalAlpha = 1;
    }
  });
  g.textAlign = "left";
  const blob = await new Promise(ok => c.toBlob(ok, "image/png"));
  const name = `amar-lifestyle-week-${days[0]}.png`;
  const file = new File([blob], name, { type: "image/png" });
  // on phones/iPad: open the share sheet (Save Image); elsewhere: download
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "My week" }); return; } catch (e) { if (e?.name === "AbortError") return; }
  }
  const a = document.createElement("a"); a.download = name; a.href = URL.createObjectURL(blob); a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast("Chart saved ✓", "ok");
}

// ---------- move a box up (earlier) or down (later) in the day, or swap it with its neighbour
const hhmm = iso => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Dhaka" });
async function applyMove(tk, newStart, scope, ctx) {
  const s = new Date(newStart), e = new Date(s.getTime() + (new Date(tk.end_at) - new Date(tk.start_at)));
  const routine = ctx.routines.find(r => r.id === tk.routine_id);
  if (routine && scope === "every") U.changedRoutine(`“${tk.title}” এর সময় বদল (প্রতি সপ্তাহ)`, { start_time: routine.start_time }, { start_time: hhmm(s.toISOString()) }, routine.id);
  else U.movedTasks(`“${tk.title}” সরানো হলো`, [{ id: tk.id, from: [tk.start_at, tk.end_at], to: [s.toISOString(), e.toISOString()] }]);
  const moveTask = async () => {
    if (routine) await api.insert("routine_skips", { routine_id: routine.id, day: tk.day, user_id: api.userId() }).catch(() => {}); // keep the routine from re-adding it
    await api.update("tasks", `id=eq.${tk.id}&status=eq.pending`, { start_at: s.toISOString(), end_at: e.toISOString() });
  };
  if (!(routine && scope === "every")) return moveTask();
  // every week: change the routine; upcoming days are rebuilt with the new time
  await api.update("routines", `id=eq.${routine.id}`, { start_time: hhmm(s.toISOString()) });
  await api.remove("tasks", `routine_id=eq.${routine.id}&status=eq.pending&day=gt.${ctx.today}`);
  if (tk.day === ctx.today) await moveTask();
  await api.rpc("ensure_tasks", { p_from: ctx.today, p_to: ctx.we > addDays(ctx.today, 7) ? ctx.we : addDays(ctx.today, 7) });
}
function moveSheet(tk, ctx, dayList) {
  const routine = ctx.routines.find(r => r.id === tk.routine_id);
  const dur = new Date(tk.end_at) - new Date(tk.start_at);
  const list = dayList.filter(x => !x.isPlan && x.status === "pending" && !x.is_timer).sort((a, b) => a.start_at.localeCompare(b.start_at));
  const i = list.findIndex(x => x.id === tk.id), prev = list[i - 1], next = list[i + 1];
  let shift = 0, swap = null; // minutes, or "up"/"down"
  let scope = "day";
  const preview = h("div.card.small", { style: { margin: "8px 0" } });
  const dayStart = new Date(dhakaIso(tk.day, "00:00")).getTime(), dayEnd = dayStart + 864e5;
  const plan = () => {
    if (swap === "up" && prev) return [[tk, new Date(prev.start_at)], [prev, new Date(new Date(tk.end_at).getTime() - (new Date(prev.end_at) - new Date(prev.start_at)))]];
    if (swap === "down" && next) return [[next, new Date(tk.start_at)], [tk, new Date(new Date(next.end_at).getTime() - dur)]];
    return [[tk, new Date(new Date(tk.start_at).getTime() + shift * 60000)]];
  };
  const draw = () => {
    const p = plan();
    preview.replaceChildren(...p.map(([x, s]) => h("div", h("b", x.title), ": ", fmtTime(x.start_at), " → ", h("b", fmtTime(s.toISOString())))));
    if (!p.some(([x, s]) => s.getTime() !== new Date(x.start_at).getTime())) preview.replaceChildren(h("span.muted", "নিচের বাটন চেপে সময় বদলান।"));
  };
  const step = m => h("button.btn.small", { type: "button", onclick: () => { swap = null; shift += m; draw(); } }, m < 0 ? `⬆ ${durLabel(-m)} আগে` : `⬇ ${durLabel(m)} পরে`);
  const scopeSeg = routine ? h("div.seg", [["day", "শুধু এই দিন"], ["every", "প্রতি সপ্তাহে"]].map(([k, l]) => h("button" + (k === scope ? ".on" : ""), { type: "button", "data-k": k, onclick: e => { scope = k; scopeSeg.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.k === k)); } }, l))) : null;
  draw();
  sheet("↕ Move “" + tk.title + "”", [
    h("div.row.wrap", { style: { gap: "6px" } }, step(-60), step(-30), step(-15), step(15), step(30), step(60)),
    prev || next ? h("div.row.wrap", { style: { gap: "6px", marginTop: "8px" } },
      prev ? h("button.btn.small", { type: "button", onclick: () => { swap = "up"; shift = 0; draw(); } }, `⇅ “${prev.title}”-এর আগে নিন`) : null,
      next ? h("button.btn.small", { type: "button", onclick: () => { swap = "down"; shift = 0; draw(); } }, `⇅ “${next.title}”-এর পরে নিন`) : null) : null,
    preview,
    scopeSeg ? h("label.f", h("span", "কোথায় বদলাবে"), scopeSeg) : null,
  ], {
    actions: close => {
      const save = h("button.btn.primary", t("Save"));
      save.onclick = busy(save, async () => {
        const p = plan().filter(([x, s]) => s.getTime() !== new Date(x.start_at).getTime());
        if (!p.length) throw new Error("আগে সময় বদলান।");
        for (const [x, s] of p) {
          const e = s.getTime() + (new Date(x.end_at) - new Date(x.start_at));
          if (s.getTime() < Date.now()) throw new Error(`“${x.title}” — এই সময় পার হয়ে গেছে।`);
          if (s.getTime() < dayStart || e > dayEnd) throw new Error("একই দিনের মধ্যে রাখুন।");
        }
        for (const [x, s] of p) await applyMove(x, s, x.routine_id ? scope : "day", ctx);
        toast(scope === "every" && p.some(([x]) => x.routine_id) ? "Moved — every week ✓" : "Moved ✓", "ok"); close(true); rerender();
      });
      return [h("button.btn", { onclick: () => close(null) }, t("Cancel")), save];
    },
  });
}
