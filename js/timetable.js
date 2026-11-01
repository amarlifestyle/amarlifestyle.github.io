// Amar Lifestyle — timetables under Routine: University classes, Coaching classes, Meal plan.
// These only show the day's plan (no DP). Meals also remind you on the Today page.
import * as api from "./api.js";
import { h, icon, toast, sheet, busy, confirmBox, todayStr, fmtHM, dhakaNow } from "./ui.js";
import { route, store, rerender, backbar } from "./app.js";
import { shrink } from "./assistant.js";

export const KINDS = {
  university: { label: "University", icon: "🎓", who: ["student"], hint: "Your university class timetable. Tap a day to see its classes." },
  coaching: { label: "Coaching", icon: "🏫", who: ["school", "student"], hint: "Your coaching / private batch classes." },
  meal: { label: "Meals", icon: "🍽️", who: null, hint: "Your own meal times. The Today page reminds you a little before each one." },
};
// which tabs this person sees (no occupation chosen yet → show all)
let hasMeals = !!api.LS.get("al_has_meals");
export const visibleKinds = () => Object.keys(KINDS).filter(k => k === "meal" ? hasMeals : (!store.profile?.occupation || KINDS[k].who.includes(store.profile.occupation)));
async function checkMeals() {
  try { const r = await api.select("timetable_items", "select=id&kind=eq.meal&limit=1"); hasMeals = r.length > 0; api.LS.set("al_has_meals", hasMeals); } catch { /* keep last */ }
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ORDER = [6, 0, 1, 2, 3, 4, 5]; // Sat first, like Bangladesh
const hm = t => (t || "").slice(0, 5);
const range = it => it.start_time ? `${fmtHM(hm(it.start_time))}${it.end_time ? " – " + fmtHM(hm(it.end_time)) : ""}` : "";

// examples shown when a tab is empty (anyone can start from these and change them)
const DEMO = {
  university: [
    { days: [6], start_time: "09:45", end_time: "11:30", title: "PHY 101", detail: "Room 2002 · Teacher" },
    { days: [6], start_time: "11:30", end_time: "13:15", title: "MATH 101", detail: "Room 4002" },
    { days: [0], start_time: "08:00", end_time: "09:45", title: "CSE 101", detail: "Room 5002" },
    { days: [1], start_time: "14:00", end_time: "15:45", title: "CSE 102 (lab)", detail: "LAB-4701" },
  ],
  coaching: [
    { days: [6, 3], start_time: "16:00", end_time: "17:00", title: "Physics", detail: "Batch / teacher" },
    { days: [6, 3], start_time: "17:00", end_time: "18:00", title: "Chemistry", detail: "" },
    { days: [1, 4], start_time: "16:00", end_time: "17:00", title: "Higher Math", detail: "" },
  ],
  meal: [
    { days: [], start_time: "08:00", end_time: "08:30", title: "Breakfast", detail: "Write what you plan to eat" },
    { days: [], start_time: "13:00", end_time: "14:00", title: "Lunch", detail: "" },
    { days: [], start_time: "17:00", end_time: "17:30", title: "Snack", detail: "" },
    { days: [], start_time: "20:30", end_time: "21:00", title: "Dinner", detail: "" },
    { days: [], start_time: null, end_time: null, title: "Keep with you", detail: "Water bottle · fruit" },
  ],
};

export async function routineTabsAsync(active) { await checkMeals(); return routineTabs(active); }
export function routineTabs(active) {
  const tabs = [["routine", "📋 My routine", "#/routine"], ...visibleKinds().map(k => [k, `${KINDS[k].icon} ${KINDS[k].label}`, `#/schedule/${k}`])];
  return h("div.seg", { style: { marginBottom: "12px", overflowX: "auto" } }, tabs.map(([k, l, href]) => h("button" + (k === active ? ".on" : ""), { onclick: () => { location.hash = href; }, style: { whiteSpace: "nowrap" } }, l)));
}

const onDay = (it, dow) => !it.days?.length || it.days.includes(dow);

route("schedule", async (page, kind = "university", dayArg) => {
  if (!KINDS[kind]) kind = "university";
  page.append(backbar("Routine", "#/more"), await routineTabsAsync(kind));
  const K = KINDS[kind];
  const items = (await api.select("timetable_items", `select=*&kind=eq.${kind}&order=start_time.nullslast,title`));
  const todayDow = dhakaNow().getDay();
  const dow = dayArg !== undefined && dayArg !== "" ? Number(dayArg) : todayDow;
  page.append(h("p.hint", K.hint));

  const tools = h("div.row.wrap", { style: { gap: "8px", marginBottom: "10px" } },
    h("button.btn.small.primary", { onclick: () => itemSheet(kind, null, kind === "meal" ? [] : [dow]) }, icon("plus"), "Add"),
    h("button.btn.small", { onclick: () => photoImport(kind) }, "📷 From a photo (AI)"));
  page.append(tools);

  if (!items.length) {
    const demo = DEMO[kind];
    page.append(h("div.card", { style: { opacity: .75, borderStyle: "dashed" } },
      h("b", "Example — you can make yours like this:"),
      h("div.list.mt", demo.map(d => h("div.li", h("div.grow", h("b", d.title), h("div.small.muted", [d.days.length ? d.days.map(x => DAYS[x]).join(", ") : (d.start_time ? "Every day" : "Note"), range(d), d.detail].filter(Boolean).join(" · ")))))),
      h("div.row.mt", { style: { gap: "8px" } },
        (() => { const b = h("button.btn.small", "Use this example"); b.onclick = busy(b, async () => { await api.insert("timetable_items", demo.map(d => ({ ...d, kind, user_id: api.userId() }))); toast("Example added — tap any item to change it ✓", "ok"); rerender(); }); return b; })())));
    return;
  }

  if (kind !== "meal") {
    // day chips (Sat → Fri), today marked
    page.append(h("div.row", { style: { gap: "6px", overflowX: "auto", marginBottom: "10px", paddingBottom: "2px" } }, ORDER.map(d => {
      const n = items.filter(it => onDay(it, d) && it.start_time).length;
      return h("a.btn.small" + (d === dow ? ".primary" : ""), { href: `#/schedule/${kind}/${d}`, style: { flexShrink: 0, minWidth: "54px", position: "relative" } },
        DAYS[d], d === todayDow ? " •" : "", n ? h("span.small", { style: { opacity: .7, marginLeft: "3px" } }, n) : null);
    })));
  }
  const list = items.filter(it => it.start_time && (kind === "meal" || onDay(it, dow)));
  const nowMin = (() => { const n = dhakaNow(); return n.getHours() * 60 + n.getMinutes(); })();
  const mins = t => { const [a, b] = hm(t).split(":").map(Number); return a * 60 + b; };
  const live = it => dow === todayDow && it.start_time && mins(it.start_time) <= nowMin && nowMin < mins(it.end_time || it.start_time) + (it.end_time ? 0 : 30);
  const nextIt = dow === todayDow ? list.find(it => mins(it.start_time) > nowMin) : null;
  page.append(h("h3", { style: { margin: "4px 2px 8px" } }, kind === "meal" ? "Every day" : (dow === todayDow ? "Today · " : "") + ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dow]));
  if (!list.length) page.append(h("div.card.empty", h("p", kind === "meal" ? "No meal times yet." : "No classes this day 🎉")));
  else page.append(h("div.list", list.map(it => h("button.li", { onclick: () => itemSheet(kind, it), style: { alignItems: "flex-start", textAlign: "left", ...(live(it) ? { borderColor: "var(--brand)", background: "color-mix(in srgb, var(--brand) 10%, var(--card))" } : {}) } },
    h("div", { style: { minWidth: "92px", fontWeight: 700, fontSize: "13px", color: live(it) ? "var(--brand)" : "var(--muted)" } }, fmtHM(hm(it.start_time)), it.end_time ? h("div.small.faint", "– " + fmtHM(hm(it.end_time))) : null),
    h("div.grow", h("b", it.title, live(it) ? h("span.badge.ok", { style: { marginLeft: "6px" } }, "Now") : it === nextIt ? h("span.badge", { style: { marginLeft: "6px" } }, "Next") : null),
      it.detail ? h("div.small.muted", it.detail) : null)))));
  const notes = items.filter(it => !it.start_time);
  notes.forEach(n => page.append(h("button.card", { onclick: () => itemSheet(kind, n), style: { width: "100%", textAlign: "left", marginTop: "10px", cursor: "pointer" } }, h("b", n.title), h("div.small.muted", { style: { marginTop: "4px" } }, n.detail || ""))));
}, { tab: "more" });

function itemSheet(kind, it, presetDays = []) {
  const title = h("input.input", { value: it?.title || "", placeholder: kind === "meal" ? "e.g. Breakfast" : "e.g. PHY 105" });
  const detail = h("textarea.input", { placeholder: kind === "meal" ? "e.g. 2 Eggs · 2 Roti · 1 Banana" : "e.g. Room 5002 · Teacher", style: { minHeight: "60px" } }, it?.detail || "");
  const start = h("input.input", { type: "time", value: hm(it?.start_time) });
  const end = h("input.input", { type: "time", value: hm(it?.end_time) });
  let days = [...(it?.days || presetDays)];
  const dayBox = h("div.row.wrap", { style: { gap: "6px" } });
  const drawDays = () => dayBox.replaceChildren(...ORDER.map(d => h("button.btn.small" + (days.includes(d) ? ".primary" : ""), { type: "button", onclick: () => { days = days.includes(d) ? days.filter(x => x !== d) : [...days, d]; drawDays(); } }, DAYS[d])));
  drawDays();
  sheet(it ? "Edit" : `Add to ${KINDS[kind].label}`, [
    h("label.f", h("span", kind === "meal" ? "Meal / note" : "Class"), title),
    h("div.grid2", h("label.f", h("span", "Start"), start), h("label.f", h("span", "End"), end)),
    h("label.f", h("span", kind === "meal" ? "Days (none = every day)" : "Days"), dayBox),
    h("label.f", h("span", kind === "meal" ? "What to eat / notes" : "Room, teacher, notes"), detail),
    kind === "meal" ? h("p.hint", "Leave the time empty to make a note (like “Keep with you”).") : null,
  ], {
    actions: close => {
      const save = h("button.btn.primary", "Save");
      save.onclick = busy(save, async () => {
        if (!title.value.trim()) throw new Error("Write a name.");
        if (kind !== "meal" && !days.length) throw new Error("Pick at least one day.");
        const row = { title: title.value.trim(), detail: detail.value.trim() || null, start_time: start.value || null, end_time: end.value || null, days };
        if (it) await api.update("timetable_items", `id=eq.${it.id}`, row); else await api.insert("timetable_items", { ...row, kind, user_id: api.userId() });
        close(true); rerender();
      });
      const out = [h("button.btn", { onclick: () => close(null) }, "Cancel"), save];
      if (it) {
        const del = h("button.btn.danger", { "aria-label": "Delete" }, icon("trash"));
        del.onclick = busy(del, async () => { if (!(await confirmBox("Delete this?", it.title, "Delete", true))) return; await api.remove("timetable_items", `id=eq.${it.id}`); close(true); rerender(); });
        out.unshift(del);
      }
      return out;
    },
  });
}

// photo of a timetable → AI reads it → you tick what to keep
function photoImport(kind) {
  const inp = h("input", { type: "file", accept: "image/*", style: { display: "none" } });
  document.body.append(inp);
  inp.onchange = async () => {
    const f = inp.files[0]; inp.remove(); if (!f) return;
    const out = h("div", h("p.small.muted", "🤖 Reading the photo…"));
    let items = [];
    const s = sheet("📷 From a photo", [h("p.hint", "AI reads the photo. Check, untick what you don't want, then save."), out], {
      actions: close => {
        const save = h("button.btn.primary", { disabled: true, id: "ttsave" }, "Save selected");
        save.onclick = busy(save, async () => {
          const rows = items.filter(x => x.on).map(x => ({ kind, user_id: api.userId(), title: x.title, detail: x.detail || null, start_time: /^\d{2}:\d{2}$/.test(x.start || "") ? x.start : null, end_time: /^\d{2}:\d{2}$/.test(x.end || "") ? x.end : null, days: (x.days || []).map(d => DAYS.indexOf(String(d).slice(0, 3))).filter(d => d >= 0) }));
          if (!rows.length) throw new Error("Tick at least one.");
          await api.insert("timetable_items", rows); toast(`Saved ${rows.length} ✓`, "ok"); close(true); rerender();
        });
        return [h("button.btn", { onclick: () => close(null) }, "Cancel"), save];
      },
    });
    try {
      const img = await shrink(f);
      const r = await api.ai("timetable", { kind, image: { mime: img.mime, data: img.data } });
      items = (r.items || []).filter(x => x.title).map(x => ({ ...x, on: true }));
      if (!items.length) { out.replaceChildren(h("p.small.bad", "Couldn't read a timetable from this photo. Try a clearer photo.")); return; }
      if (r.question) out.append(h("p.small.warn", r.question));
      out.replaceChildren(h("div.list", items.map(x => h("label.li", { style: { alignItems: "flex-start" } },
        h("input", { type: "checkbox", checked: true, style: { width: "20px", height: "20px", accentColor: "var(--brand)", flexShrink: 0 }, onchange: e => x.on = e.target.checked }),
        h("div.grow", h("b", x.title), h("div.small.muted", [(x.days || []).length ? x.days.join(", ") : (x.start ? "Every day" : "Note"), x.start ? fmtHM(x.start) + (x.end ? " – " + fmtHM(x.end) : "") : "", x.detail].filter(Boolean).join(" · ")))))));
      document.getElementById("ttsave")?.removeAttribute("disabled");
    } catch (e) { out.replaceChildren(h("p.small.bad", e.message)); }
    void s;
  };
  inp.click();
}

// Today page: meal reminder from 30 minutes before until the meal ends
export async function mealNow() {
  const items = await api.select("timetable_items", "select=*&kind=eq.meal&start_time=not.is.null&order=start_time");
  const n = dhakaNow(), now = n.getHours() * 60 + n.getMinutes(), dow = n.getDay();
  const m = t => { const [a, b] = hm(t).split(":").map(Number); return a * 60 + b; };
  const it = items.find(x => onDay(x, dow) && now >= m(x.start_time) - 30 && now <= m(x.end_time || x.start_time) + (x.end_time ? 0 : 20));
  if (!it) return null;
  const soon = now < m(it.start_time);
  return h("a.card", { href: "#/schedule/meal", style: { display: "block", color: "inherit", borderColor: "color-mix(in srgb, var(--amber) 55%, transparent)", background: "linear-gradient(160deg, color-mix(in srgb, var(--amber) 10%, var(--card)), var(--card))" } },
    h("div.row.between", h("b", "🍽️ ", it.title), h("span.small", { style: { color: "var(--amber)" } }, soon ? `in ${m(it.start_time) - now} min` : "now")),
    h("div.small.muted", range(it)), it.detail ? h("div", { style: { marginTop: "4px" } }, it.detail) : null);
}

// ---------- university classes in the daily routine (no DP, no penalty; remove any day)
const CLASS_COLOR = "#60A5FA";
export async function classesBetween(from, to) {
  if (!visibleKinds().includes("university")) return [];
  const [items, skips] = await Promise.all([
    api.select("timetable_items", "select=*&kind=eq.university&start_time=not.is.null"),
    api.select("timetable_skips", `select=item_id,day&day=gte.${from}&day=lte.${to}`),
  ]);
  const out = [];
  for (let d = from; d <= to; d = addDay(d)) {
    const dow = new Date(d + "T00:00:00").getDay();
    items.filter(it => it.kind === "university" && it.start_time && onDay(it, dow) && !skips.some(k => k.item_id === it.id && k.day === d)).forEach(it => {
      const s = new Date(`${d}T${hm(it.start_time)}:00+06:00`), e = it.end_time ? new Date(`${d}T${hm(it.end_time)}:00+06:00`) : new Date(s.getTime() + 3600e3);
      out.push({ id: `cls:${it.id}:${d}`, isClass: true, item: it, day: d, title: "🎓 " + it.title, category: "University class", start_at: s.toISOString(), end_at: e.toISOString(), status: "class", color: CLASS_COLOR, detail: it.detail });
    });
  }
  return out;
}
const addDay = d => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };
export function classSheet(c) {
  sheet("🎓 " + c.item.title, [h("p.mb0", fmtHM(hm(c.item.start_time)), c.item.end_time ? " – " + fmtHM(hm(c.item.end_time)) : "", " · ", new Date(c.day + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })),
    c.detail ? h("p.small.muted", c.detail) : null, h("p.hint", "University class from your timetable. No DP, nothing is cut if you skip it.")], {
    actions: close => {
      const rm = h("button.btn.danger", icon("trash"), "Not going — remove for this day");
      rm.onclick = busy(rm, async () => { await api.insert("timetable_skips", { user_id: api.userId(), item_id: c.item.id, day: c.day }); toast("Removed for this day ✓", "ok"); close(true); rerender(); });
      return [h("a.btn", { href: "#/schedule/university", onclick: () => close(null) }, "Timetable"), rm];
    },
  });
}
// a simple card for the Today list
export function classCard(c) {
  const x = h("button.icon-btn", { "aria-label": "Not going today", title: "Not going today", style: { width: "34px", height: "34px" } }, icon("x"));
  x.onclick = busy(x, async e => { e?.stopPropagation?.(); await api.insert("timetable_skips", { user_id: api.userId(), item_id: c.item.id, day: c.day }); toast("Removed for today ✓", "ok"); rerender(); });
  const now = Date.now(), live = now >= new Date(c.start_at) && now < new Date(c.end_at);
  return h("div.task", { style: { "--c": CLASS_COLOR, cursor: "pointer" }, onclick: e => { if (!x.contains(e.target)) classSheet(c); } },
    h("div.row.between", { style: { alignItems: "flex-start", gap: "8px" } },
      h("div.grow", h("b", "🎓 ", c.item.title, live ? h("span.badge.ok", { style: { marginLeft: "6px" } }, "Now") : null),
        h("div.small.muted", `${fmtHM(hm(c.item.start_time))}${c.item.end_time ? " – " + fmtHM(hm(c.item.end_time)) : ""} · University class${c.detail ? " · " + c.detail : ""}`),
        h("div.small.faint", "No DP · tap ✕ if you're not going")), x));
}
