// Amar Lifestyle — weekly neon chart
import * as api from "./api.js";
import { h, icon, t, toast, sheet, busy, todayStr, addDays, fmtTime, mins, durLabel, fmtDate, DAYS } from "./ui.js";
import { route, store, catColor, rerender } from "./app.js";
import { addTask } from "./today.js";

function weekStart(s) { const back = (new Date(s + "T00:00:00").getDay() + 1) % 7; return addDays(s, -back); } // week starts Saturday

route("week", async (page, offset = "0") => {
  const off = Number(offset) || 0;
  const today = todayStr();
  const ws = addDays(weekStart(today), off * 7), we = addDays(ws, 6);
  page.append(h("header.topbar",
    h("div", h("h1", t("Week")), h("div.sub", `${fmtDate(ws)} – ${fmtDate(we)}`)),
    h("div.row", h("a.icon-btn", { href: `#/week/${off - 1}`, "aria-label": "Previous week" }, icon("back")),
      h("a.icon-btn", { href: `#/week/${off + 1}`, "aria-label": "Next week" }, icon("chev")))));
  if (we >= today) { try { await api.rpc("ensure_tasks", { p_from: ws < today ? today : ws, p_to: we }); } catch {} }
  const [tasks, routines] = await Promise.all([
    api.select("tasks", `select=*&day=gte.${ws}&day=lte.${we}&order=start_at`),
    api.select("routines", "select=id,color"),
  ]);
  const rColor = Object.fromEntries(routines.filter(r => r.color).map(r => [r.id, r.color]));
  const colorOf = tk => rColor[tk.routine_id] || catColor(tk.category);

  const days = [...Array(7)].map((_, i) => addDays(ws, i));
  const maxRows = Math.max(3, ...days.map(d => tasks.filter(x => x.day === d && x.status !== "running").length));
  const grid = h("div.week", days.map(d => {
    const list = tasks.filter(x => x.day === d && x.status !== "running");
    const dow = new Date(d + "T00:00:00").getDay();
    return h("div.wday",
      h("button.h" + (d === today ? ".today" : ""), { style: { width: "100%", background: "transparent", cursor: "pointer" }, onclick: () => d >= today && addTask(null, { day: d }), "aria-label": `Add task on ${DAYS[dow]}` },
        DAYS[dow], h("small", fmtDate(d))),
      list.map(tk => {
        const st = ["completed", "late_completed"].includes(tk.status) ? ".done" : ["missed", "not_completed"].includes(tk.status) ? ".missed" : "";
        return h("div.cell" + st, { style: { "--c": colorOf(tk) }, role: "button", tabindex: "0", onclick: () => detail(tk) },
          fmtTime(tk.start_at).replace(":00", ""), " → ", tk.title, h("small", durLabel(mins(tk.start_at, tk.end_at))));
      }),
      [...Array(maxRows - list.length)].map(() => h("div.cell.empty", "—")));
  }));
  page.append(h("div.week-scroll", grid));
  page.append(h("p.small.faint", "Tap a day name to add a task. ✓ = done, faded = missed."));

  // totals
  const done = tasks.filter(x => ["completed", "late_completed"].includes(x.status));
  const byCat = {};
  done.forEach(x => byCat[x.category] = (byCat[x.category] || 0) + mins(x.start_at, x.end_at));
  const dp = tasks.reduce((s, x) => s + (x.dp_awarded || 0), 0);
  page.append(h("div.card.week-total", h("h3", "This week"),
    h("div.grid3", h("div.stat", h("div.k", "Tasks done"), h("div.v", `${done.filter(x => !x.is_timer).length}/${tasks.filter(x => !x.is_timer).length}`)),
      h("div.stat", h("div.k", "DP"), h("div.v", dp)), h("div.stat", h("div.k", "Hours"), h("div.v", (Object.values(byCat).reduce((a, b) => a + b, 0) / 60).toFixed(1)))),
    Object.keys(byCat).length ? h("div.mt", Object.entries(byCat).map(([c, m]) => h("div.row.between.small", { style: { padding: "4px 0" } },
      h("span", h("i", { style: { display: "inline-block", width: "10px", height: "10px", borderRadius: "3px", background: catColor(c), marginRight: "6px" } }), c), h("b", durLabel(m))))) : null));
  const img = h("button.btn.block", icon("download"), "Save chart as image");
  img.onclick = busy(img, async () => saveImage(days, tasks, colorOf, today));
  page.append(img);
}, { tab: "week" });

function detail(tk) {
  const st = { pending: "Not marked yet", completed: `Done · +${tk.dp_awarded} DP`, late_completed: "Done late · 0 DP", not_completed: `Not done · ${tk.dp_awarded} DP`, missed: `Missed · ${tk.dp_awarded} DP` }[tk.status] || tk.status;
  const future = tk.status === "pending" && new Date(tk.start_at) > new Date();
  sheet(tk.title, h("div",
    h("p.muted", `${fmtDate(tk.day, { weekday: "long", day: "numeric", month: "short" })} · ${fmtTime(tk.start_at)} – ${fmtTime(tk.end_at)}`),
    h("p", h("b", tk.category), " · ", tk.dp_value, " DP"), h("p", st)), {
    actions: close => [h("button.btn", { onclick: () => close() }, "Close"),
      future ? h("button.btn.primary", { onclick: () => { close(); addTask(tk); } }, icon("edit"), "Edit") : null].filter(Boolean),
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
