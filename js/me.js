// Amar Lifestyle — profile, stats, badges, heatmap, life tracking, people
import * as api from "./api.js";
import { h, icon, t, toast, sheet, busy, todayStr, addDays, fmtDate, barChart, donut, PALETTE } from "./ui.js";
import { route, store, catColor, rerender, backbar } from "./app.js";

export function badgesFrom(s) {
  const study = Number(s.hours30?.["Study + Class"] || 0);
  const out = [];
  if (s.streak >= 7) out.push(["🔥", "7-day streak"]);
  if (s.streak >= 30) out.push(["🏅", "30-day streak"]);
  if (s.streak >= 100) out.push(["👑", "100-day streak"]);
  if (study >= 10) out.push(["📚", "10 study hours (30 days)"]);
  if (study >= 50) out.push(["🎓", "50 study hours (30 days)"]);
  if (study >= 100) out.push(["🧠", "100 study hours (30 days)"]);
  if (Number(s.year_dp) >= 10000) out.push(["💎", "10,000 DP this year"]);
  return out;
}

export function heatmap(map) {
  const today = todayStr();
  let start = addDays(today, -364);
  start = addDays(start, -new Date(start + "T00:00:00").getDay());
  const cells = [];
  for (let d = start; d <= today; d = addDays(d, 1)) {
    const n = map?.[d] || 0;
    cells.push(h("i" + (n ? `.l${Math.min(4, n)}` : ""), { title: `${fmtDate(d)}: ${n} task${n === 1 ? "" : "s"} done` }));
  }
  const box = h("div.heat", cells);
  setTimeout(() => box.scrollLeft = box.scrollWidth, 50);
  return box;
}

export function statCharts(s) {
  const parts = Object.entries(s.hours30 || {}).map(([c, v]) => ({ l: c, v: Number(v), c: catColor(c), fmt: v + "h" }));
  return [
    h("div.card", h("h3", "DP — last 30 days"), barChart(s.daily.map(d => ({ l: d.day.slice(8), v: d.dp })))),
    parts.length ? h("div.card", h("h3", "Where your time went (30 days)"), donut(parts, { center: parts.reduce((a, p) => a + p.v, 0).toFixed(0) + "h" })) : null,
    s.months?.length ? h("div.card", h("h3", "DP by month (this year)"), barChart(s.months.map(m => ({ l: new Date(m.month + "-01").toLocaleDateString("en-GB", { month: "short" }), v: m.dp })), { color: "var(--amber)" })) : null,
    h("div.card", h("h3", "Your year"), h("p.hint", "Each square is a day. Greener = more tasks done."), heatmap(s.heatmap)),
  ];
}

route("me", async page => {
  const s = await api.rpc("my_stats");
  const p = store.profile;
  const lv = s.level;
  const prog = lv.next_min ? (s.month_dp - lv.cur_min) / (lv.next_min - lv.cur_min) : 1;
  page.append(h("header.topbar", h("div", h("h1", p.name), h("div.sub", "Member since " + fmtDate(p.created_at.slice(0, 10), { month: "long", year: "numeric" }))),
    h("a.icon-btn", { href: "#/settings", "aria-label": t("Settings") }, icon("gear"))));
  page.append(h("div.hero", { style: { flexDirection: "column", alignItems: "stretch" } },
    h("div.row.between", h("span.level-pill", icon("medal"), `${lv.name} · this month`), h("span.badge", "Year rank: ", s.year_level.name)),
    h("div", h("span.big", s.month_dp), h("span.muted", " DP this month")),
    h("div.bar", h("i", { style: { width: Math.max(0, Math.min(1, prog)) * 100 + "%" } })),
    h("div.small.muted", lv.next ? `${lv.next_min - s.month_dp} DP more to reach ${lv.next}. New season starts on the 1st.` : "Diamond — the top level! 💎")));
  page.append(h("div.grid3",
    h("div.stat", h("div.k", "🔥 " + t("Streak")), h("div.v", s.streak + "d")),
    h("div.stat", h("div.k", "🪙 " + t("Coins")), h("div.v", s.coins_total)),
    h("div.stat", h("div.k", "Year DP"), h("div.v", s.year_dp))));
  const badges = badgesFrom(s);
  page.append(h("div.card.mt", h("h3", "Badges"), badges.length ? h("div.row.wrap", { style: { gap: "8px" } }, badges.map(([e, l]) => h("span.badge", e + " " + l)))
    : h("p.hint.mb0", "Earn badges with a 7-day streak, 10 study hours and more.")));
  page.append(...statCharts(s).filter(Boolean));
  page.append(h("div.list",
    h("a.li", { href: "#/life" }, h("div.ic", icon("heart")), h("div.grow", h("b", "Sleep, water, habits & diary")), icon("chev", "chev")),
    h("a.li", { href: "#/people" }, h("div.ic", icon("people")), h("div.grow", h("b", "People"), h("div.small.muted", "See friends' levels")), icon("chev", "chev")),
    h("a.li", { href: "#/reports" }, h("div.ic", icon("report")), h("div.grow", h("b", t("Reports"))), icon("chev", "chev"))));
}, { tab: "me" });

// ---------- life tracking
route("life", async page => {
  const today = todayStr();
  page.append(backbar("Daily life", "#/me"));
  const [logs, habits, hlogs] = await Promise.all([
    api.select("life_logs", `select=*&day=gte.${addDays(today, -13)}&order=day.desc`),
    api.select("bad_habits", "select=*&order=created_at"),
    api.select("habit_logs", "select=*&order=day.desc&limit=500"),
  ]);
  const L = logs.find(l => l.day === today) || { user_id: api.userId(), day: today, water: 0 };
  const save = async patch => { Object.assign(L, patch); const r = await api.offlineSafe({ kind: "upsert", table: "life_logs", onConflict: "user_id,day", rows: [{ user_id: api.userId(), day: today, water: L.water || 0, slept_at: L.slept_at || null, woke_at: L.woke_at || null, mood: L.mood || null, diary: L.diary || null }] }); if (r?.queued) toast("Saved offline ✓"); };

  // water
  const wv = h("span.big", L.water || 0);
  const plus = h("button.btn.primary", icon("plus"), "1 glass");
  plus.onclick = busy(plus, async () => { await save({ water: (L.water || 0) + 1 }); wv.textContent = L.water; });
  const minus = h("button.btn", "−");
  minus.onclick = busy(minus, async () => { if (L.water > 0) { await save({ water: L.water - 1 }); wv.textContent = L.water; } });
  page.append(h("div.card", h("h3", "💧 Water today"), h("div.row.between", h("div", wv, h("span.muted", " glasses")), h("div.row", minus, plus))));

  // sleep
  const sa = h("input.input", { type: "time", value: L.slept_at?.slice(0, 5) || "" });
  const wa = h("input.input", { type: "time", value: L.woke_at?.slice(0, 5) || "" });
  const sb = h("button.btn.block", t("Save"));
  sb.onclick = busy(sb, async () => { await save({ slept_at: sa.value || null, woke_at: wa.value || null }); toast("Sleep saved ✓", "ok"); });
  const lastN = logs.filter(l => l.slept_at && l.woke_at).slice(0, 7);
  const hrs = l => { const [a, b] = [l.slept_at, l.woke_at].map(x => { const [H, M] = x.split(":").map(Number); return H * 60 + M; }); return ((b - a + 1440) % 1440) / 60; };
  page.append(h("div.card", h("h3", "😴 Sleep"), h("p.hint", "When did you sleep last night and wake up today?"),
    h("div.grid2", h("label.f", h("span", "Slept at"), sa), h("label.f", h("span", "Woke at"), wa)), sb,
    lastN.length ? h("p.small.muted.mt.mb0", `Average last ${lastN.length} nights: ${(lastN.reduce((a, l) => a + hrs(l), 0) / lastN.length).toFixed(1)} hours`) : null));

  // mood + diary
  const moods = [["great", "😀"], ["okay", "😐"], ["bad", "😞"]];
  const mrow = h("div.seg", moods.map(([k, e]) => h("button" + (L.mood === k ? ".on" : ""), { type: "button", style: { fontSize: "22px" }, "aria-label": k, onclick: async ev => { await save({ mood: k }); mrow.querySelectorAll("button").forEach(b => b.classList.toggle("on", b === ev.currentTarget)); } }, e)));
  const diary = h("textarea.input", { placeholder: "How was your day? (only you can see this)", maxlength: "2000" }, L.diary || "");
  const db = h("button.btn.block.mt", t("Save"));
  db.onclick = busy(db, async () => { await save({ diary: diary.value }); toast("Diary saved ✓", "ok"); });
  page.append(h("div.card", h("h3", "📝 Mood & diary"), mrow, h("div.mt", diary), db));

  // bad habits — tap + each time it happens (e.g. each cigarette), − to undo
  const hb = h("div.card", h("div.row.between", h("h3.mb0", "🚫 Bad habits"), h("button.btn.small", { onclick: addHabit }, icon("plus"), "Add")),
    h("p.hint.mt", "Tap ＋ each time it happens (for smoking: once per cigarette). No DP is cut — it's just for you to see the pattern."));
  const SMOKE = /smok|cigar|sigar|সিগার|ধূমপান|বিড়ি|বিড়ি/i;
  habits.forEach(hab => {
    const mine = hlogs.filter(x => x.habit_id === hab.id);
    const todayN = mine.filter(x => x.day === today).length;
    const last = mine[0]?.day;
    const clean = last ? Math.round((new Date(today) - new Date(last)) / 864e5) : Math.round((new Date(today) - new Date(hab.created_at.slice(0, 10))) / 864e5);
    const month = mine.filter(x => x.day.slice(0, 7) === today.slice(0, 7)).length;
    const week = mine.filter(x => x.day > addDays(today, -7)).length;
    const unit = SMOKE.test(hab.name) ? ["cigarette", "cigarettes"] : ["time", "times"];
    const u = n => `${n} ${n === 1 ? unit[0] : unit[1]}`;
    const plus = h("button.btn.small", { "aria-label": "Add one" }, "＋1");
    plus.onclick = busy(plus, async () => { await api.insert("habit_logs", { user_id: api.userId(), habit_id: hab.id, day: today }); rerender(); });
    const minus = h("button.btn.small.ghost", { "aria-label": "Undo one", disabled: !todayN }, "−");
    minus.onclick = busy(minus, async () => { const x = mine.find(y => y.day === today); if (x) await api.remove("habit_logs", `id=eq.${x.id}`); rerender(); });
    hb.append(h("div.row.between", { style: { padding: "10px 0", borderTop: "1px solid var(--line)", gap: "8px" } },
      h("div.grow", h("b", hab.name),
        h("div.small", { style: { color: todayN ? "var(--red)" : "var(--green)" } }, todayN ? `Today: ${u(todayN)}` : "Today: none 👍"),
        h("div.small.muted", `${todayN ? "" : clean + " day" + (clean === 1 ? "" : "s") + " clean · "}7 days: ${u(week)} · this month: ${u(month)}`)),
      h("div.row", { style: { gap: "6px" } }, minus, plus)));
  });
  page.append(hb);
}, { tab: "me" });

function addHabit() {
  const n = h("input.input", { placeholder: "e.g. Smoking · Sleeping after 1 AM" });
  sheet("Add bad habit", [h("label.f", h("span", "Habit"), n)], {
    actions: close => { const s = h("button.btn.primary", t("Save")); s.onclick = busy(s, async () => { if (!n.value.trim()) throw new Error("Write the habit."); await api.insert("bad_habits", { user_id: api.userId(), name: n.value.trim() }); close(true); rerender(); });
      return [h("button.btn", { onclick: () => close(null) }, t("Cancel")), s]; },
  });
}

// ---------- people
route("people", async page => {
  page.append(backbar("People", "#/me"));
  const people = await api.rpc("list_people");
  page.append(h("p.hint", "Only what each person made public is shown."));
  page.append(h("div.list", people.map(p => h("a.li", { href: `#/person/${p.id}` },
    h("div.ic", p.name.slice(0, 1)), h("div.grow", h("b", p.name, p.id === api.userId() ? " (you)" : ""), h("div.small.muted", [p.level, p.month_dp != null ? p.month_dp + " DP" : null, p.streak != null ? "🔥 " + p.streak + "d" : null].filter(Boolean).join(" · ") || "Private")),
    icon("chev", "chev")))));
}, { tab: "me" });

route("person", async (page, id) => {
  page.append(backbar("Profile", "#/people"));
  const p = await api.rpc("public_profile", { p_user: id });
  page.append(h("div.hero", { style: { flexDirection: "column", alignItems: "stretch" } },
    h("h2", { style: { margin: 0 } }, p.name), h("div.small.muted", "Member since " + fmtDate(p.since.slice(0, 10), { month: "long", year: "numeric" })),
    p.level ? h("div.row.wrap", { style: { gap: "8px" } }, h("span.level-pill", icon("medal"), p.level.name + " · this month"), h("span.badge", "Year rank: " + p.year_level.name)) : null,
    p.month_dp != null ? h("div", h("span.big", p.month_dp), h("span.muted", ` DP this month · ${p.year_dp} this year · 🪙 ${p.coins_total}`)) : null,
    p.streak != null ? h("div", "🔥 ", p.streak, " day streak") : null));
  if (p.badges_src) { const b = badgesFrom({ ...p.badges_src, hours30: p.badges_src.hours30 }); if (b.length) page.append(h("div.card", h("h3", "Badges"), h("div.row.wrap", { style: { gap: "8px" } }, b.map(([e, l]) => h("span.badge", e + " " + l))))); }
  if (p.daily) page.append(...statCharts({ daily: p.daily, hours30: p.hours30, heatmap: p.heatmap }).filter(Boolean));
  if (!p.level && p.month_dp == null && !p.daily) page.append(h("div.card.empty", icon("lock"), h("p", "This profile is private.")));
}, { tab: "me" });
