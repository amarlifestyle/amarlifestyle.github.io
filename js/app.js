// Amar Lifestyle — app shell, router and shared state
import * as api from "./api.js";
import { h, icon, t, toast, todayStr, addDays, chime } from "./ui.js";

export const store = { profile: null, cfg: {}, userCats: [], announcements: [] };

export function catColor(name) {
  return store.cfg.categories?.[name]?.color || store.userCats.find(c => c.name === name)?.color || "#94A3B8";
}
// what you do decides which categories and sections the app shows
export const ROLES = {
  school: { label: "School / college student", bn: "Student", icon: "📚", cats: ["Study + Class", "Skill learning", "Gym / Running", "Work / Personal"], tuition: false, income: ["Family", "Gift", "Other income"] },
  student: { label: "University student", bn: "University student", icon: "🎓", cats: ["Study + Class", "Tuition", "Skill learning", "Gym / Running", "Work / Personal"], tuition: true, income: ["Tuition", "Family", "Video work", "Gift", "Other income"] },
  teacher: { label: "Teacher", bn: "Teacher", icon: "👨‍🏫", cats: ["Class / Teaching", "Lesson prep", "Exam checking", "Tuition", "Skill learning", "Gym / Running", "Work / Personal"], tuition: true, income: ["Salary", "Tuition", "Other income"] },
  business: { label: "Business", bn: "Business", icon: "💼", cats: ["Meeting", "Client work", "Shop / Sales", "Accounts", "Skill learning", "Gym / Running", "Work / Personal"], tuition: false, income: ["Sales", "Client payment", "Other income"] },
  job: { label: "Job holder", bn: "Job holder", icon: "🏢", cats: ["Office work", "Meeting", "Skill learning", "Side work", "Gym / Running", "Work / Personal"], tuition: false, income: ["Salary", "Bonus", "Side income", "Other income"] },
  homemaker: { label: "Homemaker", bn: "Homemaker", icon: "🏠", cats: ["Cooking", "Housework", "Children care", "Bazar / Shopping", "Learning / Reading", "Gym / Running", "Work / Personal"], tuition: false, income: ["Family", "Gift", "Side income", "Other income"] },
};
// chips: pick what you do — one or two (e.g. Job holder + University student)
export const myRoles = (p = store.profile) => { const r = (p?.roles || []).filter(k => ROLES[k]); return r.length ? r : (p?.occupation && ROLES[p.occupation] ? [p.occupation] : []); };
export function occupationPicker(current, onPick) {
  let sel = Array.isArray(current) ? [...current] : current ? [current] : [];
  const box = h("div");
  const chips = h("div.row.wrap", { style: { gap: "6px" } });
  const draw = () => chips.replaceChildren(...Object.entries(ROLES).map(([k, r]) =>
    h("button.btn.small" + (sel.includes(k) ? ".primary" : ""), { type: "button", onclick: () => {
      sel = sel.includes(k) ? sel.filter(x => x !== k) : [...sel, k].slice(-2); // at most two
      draw(); onPick([...sel]);
    } }, sel.includes(k) ? "✓ " : "", r.icon, " ", r.label)));
  draw();
  box.append(chips, h("div.small.muted", { style: { marginTop: "6px" } }, "You can pick two, e.g. Job holder + University student."));
  return box;
}
export async function saveOccupation(list) {
  const roles = (Array.isArray(list) ? list : [list]).filter(k => ROLES[k]).slice(0, 2);
  await api.update("profiles", `id=eq.${store.profile.id}`, { occupation: roles[0] || null, roles });
  store.profile.occupation = roles[0] || null; store.profile.roles = roles;
  api.LS.set("al_basics", { ...(api.LS.get("al_basics") || {}), profile: store.profile });
}
// everything a person's roles add up to (categories, tuition, income types)
export const role = () => {
  const rs = myRoles().map(k => ROLES[k]);
  if (!rs.length) return null;
  const uniq = a => [...new Set(a)];
  return { label: rs.map(r => r.label).join(" + "), icon: rs.map(r => r.icon).join(""), cats: uniq(rs.flatMap(r => r.cats)), tuition: rs.some(r => r.tuition), income: uniq(rs.flatMap(r => r.income)) };
};
export const showTuition = () => !role() || role().tuition;
export function catNames() {
  const r = role();
  const base = (r ? r.cats : ["Study + Class", "Tuition", "Gym / Running", "Work / Personal"]).filter(c => store.cfg.categories?.[c]);
  return [...base, ...store.userCats.map(c => c.name).filter(n => !base.includes(n))];
}
export function catDp(name) {
  return store.cfg.categories?.[name]?.dp ?? store.userCats.find(c => c.name === name)?.dp ?? store.cfg.custom_category_dp ?? 5;
}

export async function loadBasics() {
  const [prof, cfgRows, cats, ann] = await Promise.all([
    api.select("profiles", "select=*"),
    api.select("app_config", "select=key,value"),
    api.select("user_categories", "select=*&order=name"),
    api.select("announcements", "select=*&order=created_at.desc&limit=5"),
  ]);
  store.profile = prof[0];
  store.cfg = Object.fromEntries(cfgRows.map(r => [r.key, r.value]));
  store.userCats = cats;
  store.announcements = ann;
  api.LS.set("al_basics", { profile: store.profile, cfg: store.cfg, userCats: cats, announcements: ann });
  applyTheme(store.profile.theme);
  api.LS.set("al_lang", store.profile.lang);
}
export function applyTheme() { // dark only
  document.documentElement.dataset.theme = "dark";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#0B1220");
}

// daily housekeeping: missed tasks, routine tasks for the next week, monthly fixed costs, offline marks
let lastDaily = "";
export async function daily() {
  const d = todayStr();
  if (lastDaily === d) return;
  lastDaily = d;
  try {
    const q = await api.flushQueue();
    syncToast(q);
    await api.rpc("settle_missed");
    // phone model (Chrome on Android tells it only when asked) — once a day, for the admin's device list
    try { const ud = navigator.userAgentData; if (ud?.getHighEntropyValues) ud.getHighEntropyValues(["model", "platformVersion"]).then(v => { const m = [v.model, ud.platform, v.platformVersion?.split(".")[0]].filter(Boolean).join(" "); if (m) api.rpc("set_device", { p_model: m }).catch(() => {}); }).catch(() => {});
      else { const ua = navigator.userAgent, m = /iPhone/.test(ua) ? "iPhone iOS " + ((ua.match(/OS (\d+)/) || [])[1] || "") : /iPad/.test(ua) ? "iPad" : (ua.match(/Android [\d.]+; ([^;)]+)/) || [])[1]; if (m) api.rpc("set_device", { p_model: m.trim() }).catch(() => {}); } } catch { /* fine */ }
    // classes from Today-only timetables are real tasks now: build them once
    if (!api.LS.get("al_cls_sync")) { await import("./timetable.js").then(m => m.syncWeekly()).catch(() => {}); api.LS.set("al_cls_sync", 1); }
    await api.rpc("ensure_tasks", { p_from: d, p_to: addDays(d, 7) });
    await api.rpc("apply_recurring");
  } catch (e) { if (!e.offline) console.warn(e); lastDaily = ""; }
}

function syncToast(results) {
  const ok = results.filter(r => !r.error).length;
  if (ok) toast(`Back online — ${ok} offline change${ok > 1 ? "s" : ""} synced ✓`, "ok");
  results.filter(r => r.error).forEach(r => toast(`Not accepted: ${r.error}`, "bad"));
}

// ---------- router
const snapshots = new Map();
let renderTurn = 0;
const routes = {};
export function route(path, render, opts = {}) { routes[path] = { render, ...opts }; }
const NAV = [["today", "#/today", "Today"], ["week", "#/week", "Routine"], ["ai", null, "AI"], ["money", "#/money", "Money"], ["me", "#/me", "Me"]];
const MAIN = new Set(["today", "week", "money", "me", "notifications", "more", "exams", "prayer", "syllabus", "schedule"]);

export function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }

async function render() {
  const [path, ...args] = (location.hash.replace(/^#\/?/, "") || "today").split("/");
  const r = routes[path] || routes.today;
  const app = document.getElementById("app");
  if (!r.public && !api.getSession()) return go("#/home");
  if (!r.public && !store.profile) {
    const cached = api.LS.get("al_basics");
    if (cached) Object.assign(store, cached);
    try { await loadBasics(); } catch (e) { if (!cached) { app.replaceChildren(h("div.empty", e.message)); return; } }
  }
  document.querySelector(".nav")?.remove();
  document.body.classList.toggle("no-nav", !!r.public);
  if (!r.public) document.body.appendChild(navBar(r.tab || path));
  // show the last picture of this page at once (not tappable) while fresh data loads, then swap — no blank flashes
  const key = location.hash || "#/today";
  const same = app.firstElementChild?.dataset?.key === key;
  const prevY = same ? scrollY : 0;
  const snap = same ? app.firstElementChild : snapshots.get(key);
  const page = h("div.page", { "data-key": key });
  const myTurn = ++renderTurn;
  if (snap) {
    const ghost = snap.cloneNode(true); ghost.classList.add("ghost"); ghost.removeAttribute("data-key");
    Object.assign(page.style, { position: "absolute", left: "0", right: "0", top: "0", visibility: "hidden" });
    app.replaceChildren(ghost, page);
  } else app.replaceChildren(page);
  if (!same) window.scrollTo(0, 0);
  api.resetStale();
  try {
    await r.render(page, ...args); if (api.isStale && !r.public) page.prepend(offlineNote());
    const tb = page.querySelector(":scope > header.topbar");
    if (!r.public && tb && MAIN.has(path)) tb.append(topActions(path === "notifications" ? "alerts" : path));
  }
  catch (e) { page.replaceChildren(h("div.empty", icon("info"), h("p", e.message || "Could not load."), h("button.btn", { onclick: render }, "Try again"))); }
  if (myTurn !== renderTurn) return; // user already moved on
  page.removeAttribute("style"); page.classList.add(snap ? "swap" : "fresh");
  app.replaceChildren(page);
  if (same) window.scrollTo(0, prevY);
  snapshots.set(key, page);
  dragFab();
  if (!r.public) { daily(); checkUnread(); }
}
function navBar(active) {
  return h("nav.nav", { "aria-label": "Main" }, h("div.nav-inner",
    NAV.map(([k, href, label]) => k === "ai"
      ? h("button.nav-ai", { type: "button", "aria-label": "AI assistant", onclick: () => import("./assistant.js").then(m => m.askSheet()) }, h("span.nav-ai-orb", icon("spark")), h("small", "AI"))
      : h("a" + (k === active ? ".on" : ""), { href, "aria-current": k === active ? "page" : null }, icon(k), t(label)))));
}
// 🔔 Alerts and ⋯ More sit at the top right of the main pages
function topActions(active) {
  const bell = h("a.icon-btn.top-bell" + (active === "alerts" ? ".on" : ""), { href: "#/notifications", "aria-label": "Alerts" }, icon("bell"), unread > 0 ? h("i.nav-badge", unread > 9 ? "9+" : String(unread)) : null);
  const more = h("a.icon-btn" + (active === "more" ? ".on" : ""), { href: "#/more", "aria-label": "More" }, icon("more"));
  const notes = h("button.icon-btn.top-notes", { type: "button", "aria-label": "Notes", onclick: () => import("./notes.js").then(m => m.openNotes()) }, icon("edit"));
  setTimeout(() => import("./notes.js").then(m => m.refreshNotesBadge()), 0);
  return h("div.top-actions", notes, bell, more);
}
// unread count on the 🔔 Alerts tab
let unread = 0, unreadAt = 0;
export function setUnread(n) { unread = n; document.querySelectorAll(".top-bell .nav-badge").forEach(x => x.remove()); }
async function checkUnread() {
  if (Date.now() - unreadAt < 60000 || !api.getSession()) return;
  unreadAt = Date.now();
  try {
    const r = await api.select("inbox", `select=id&read=eq.false&created_at=gt.${new Date(Date.now() - 3 * 3600e3).toISOString()}&limit=20`);
    if (r.length !== unread) { unread = r.length; document.querySelectorAll(".top-bell").forEach(a => { a.querySelector(".nav-badge")?.remove(); if (unread) a.append(h("i.nav-badge", unread > 9 ? "9+" : String(unread))); }); }
  } catch { /* offline */ }
}
export const rerender = () => render();

// the round ＋ button can be dragged anywhere so it never covers what you want to tap
let lastY = 0;
addEventListener("scroll", () => {
  const y = scrollY, atEnd = innerHeight + y >= document.documentElement.scrollHeight - 4;
  if (y < 40 || (y < lastY - 6 && !atEnd)) document.body.classList.remove("fab-away");
  else if (y > lastY + 6 || atEnd) document.body.classList.add("fab-away");
  lastY = y;
}, { passive: true });
function dragFab() {
  document.body.classList.remove("fab-away"); lastY = scrollY;
  const fab = document.querySelector(".fab");
  if (!fab) return;
  const place = pos => {
    const w = innerWidth, hgt = innerHeight, sz = fab.offsetWidth || 52;
    const x = Math.min(w - sz - 6, Math.max(6, pos.x * w)), y = Math.min(hgt - sz - 6, Math.max(6, pos.y * hgt));
    Object.assign(fab.style, { left: x + "px", top: y + "px", right: "auto", bottom: "auto" });
  };
  const saved = api.LS.get("al_fab_pos");
  if (saved) place(saved);
  fab.style.touchAction = "none";
  let start = null, moved = false;
  fab.addEventListener("pointerdown", e => { start = { x: e.clientX, y: e.clientY, r: fab.getBoundingClientRect() }; moved = false; fab.setPointerCapture(e.pointerId); });
  fab.addEventListener("pointermove", e => {
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (!moved && Math.hypot(dx, dy) < 8) return;
    moved = true; fab.style.transition = "none"; fab.style.opacity = ".85";
    place({ x: (start.r.left + dx) / innerWidth, y: (start.r.top + dy) / innerHeight });
  });
  fab.addEventListener("pointerup", () => {
    if (moved) { const r = fab.getBoundingClientRect(); api.LS.set("al_fab_pos", { x: r.left / innerWidth, y: r.top / innerHeight }); fab.style.opacity = ""; }
    start = null;
  });
  fab.addEventListener("click", e => { if (moved) { e.stopImmediatePropagation(); e.preventDefault(); moved = false; } }, true);
}
function offlineNote() {
  const n = api.pendingOps().length;
  return h("div.card.small", { style: { borderColor: "color-mix(in srgb, var(--amber) 55%, transparent)" } },
    "📴 Offline — showing your last saved data.", n ? ` ${n} change${n > 1 ? "s" : ""} waiting to sync.` : "", " Marks, new tasks, timers, money and life entries still work and sync automatically.");
}

export function topbar(title, sub, right) {
  return h("header.topbar", h("div", h("h1", title), sub ? h("div.sub", sub) : null), right || null);
}
export function backbar(title, back = "#/more", right) {
  return h("header.topbar", h("div.row", h("a.icon-btn", { href: back, "aria-label": "Back" }, icon("back")), h("h1", title)), right || null);
}

// anonymous usage count for the admin: a random id per device, no names, no content
function track(newPage) {
  try {
    let vis = api.LS.get("al_vid"); if (!vis) { vis = (crypto.randomUUID?.() || String(Math.random()).slice(2) + Date.now()); api.LS.set("al_vid", vis); }
    let sid = sessionStorage.getItem("al_sid"); if (!sid) { sid = crypto.randomUUID?.() || "00000000-0000-4000-8000-" + String(Date.now()).slice(-12).padStart(12, "0"); sessionStorage.setItem("al_sid", sid); }
    const ua = navigator.userAgent, standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    const device = (/iPhone|iPod/.test(ua) ? "iPhone" : /iPad|Macintosh.*Mobile/.test(ua) || (navigator.maxTouchPoints > 1 && /Mac/.test(ua)) ? "iPad" : /Android/.test(ua) ? "Android" : "Computer") + (standalone ? " (app)" : " (browser)");
    const ref = api.LS.get("al_ref");
    api.rpc("track_visit", { p_visit: sid, p_visitor: vis, p_device: device, p_path: (location.hash.split("/")[1] || "home").slice(0, 30), p_new_page: !!newPage })
      .then(() => { if (ref && !sessionStorage.getItem("al_refd")) { sessionStorage.setItem("al_refd", 1); return api.rpc("track_ref", { p_visit: sid, p_ref: ref }); } }).catch(() => {});
  } catch { /* never block the app */ }
}
export function start() {
  // came from a friend's shared link (?r=code): remember it so the admin can count visits / new accounts from shares
  try { const r = new URLSearchParams(location.search).get("r"); if (r && /^[0-9a-f]{8}$/.test(r)) { if (!api.LS.get("al_ref")) api.LS.set("al_ref", r); history.replaceState(null, "", location.pathname + location.hash); } } catch {}
  // a reminder arrived while the app is open: play a sound and show it
  navigator.serviceWorker?.addEventListener("message", e => {
    if (e.data?.type !== "push") return;
    chime(e.data.level); toast(e.data.title, e.data.level === "urgent" ? "bad" : ""); unreadAt = 0; checkUnread();
  });
  window.addEventListener("hashchange", render);
  track(false);
  window.addEventListener("hashchange", () => track(true));
  setInterval(() => { if (!document.hidden) track(false); }, 60000); // keeps "time spent" up to date
  window.addEventListener("online", () => { api.flushQueue().then(r => { if (r.length) { syncToast(r); render(); } }); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && api.getSession()) daily(); });
  applyTheme();
  // home-screen app has no browser back button: swipe from the left edge to go back
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (standalone) {
    let sx = null, sy = 0;
    addEventListener("touchstart", e => { const t = e.touches[0]; sx = t.clientX < 28 && e.touches.length === 1 ? t.clientX : null; sy = t.clientY; }, { passive: true });
    addEventListener("touchend", e => {
      if (sx === null) return; const t = e.changedTouches[0];
      if (t.clientX - sx > 70 && Math.abs(t.clientY - sy) < 60) {
        const open = document.querySelector(".backdrop");
        if (open) open.click(); else if (history.length > 1) history.back();
      }
      sx = null;
    }, { passive: true });
  }
  render();
}

// ছেলে / মেয়ে — optional, can be changed any time
export const GENDERS = { male: "Male", female: "Female", other: "Prefer not to say" };
export function genderPicker(cur, onPick) {
  const box = h("div.seg");
  const draw = () => box.replaceChildren(...Object.entries(GENDERS).map(([k, l]) => h("button" + (k === cur ? ".on" : ""), { type: "button", onclick: () => { cur = k; onPick(k); draw(); } }, l)));
  draw(); return box;
}
