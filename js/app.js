// Amar Lifestyle — app shell, router and shared state
import * as api from "./api.js";
import { h, icon, t, toast, todayStr, addDays } from "./ui.js";

export const store = { profile: null, cfg: {}, userCats: [], announcements: [] };

export function catColor(name) {
  return store.cfg.categories?.[name]?.color || store.userCats.find(c => c.name === name)?.color || "#94A3B8";
}
export function catNames() {
  return [...Object.keys(store.cfg.categories || {}), ...store.userCats.map(c => c.name)];
}
export function catDp(name) {
  return store.cfg.categories?.[name]?.dp ?? store.cfg.custom_category_dp ?? 5;
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
export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === "light" ? "light" : "dark";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#F4F4EF" : "#07090D");
  api.LS.set("al_theme", theme);
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
const routes = {};
export function route(path, render, opts = {}) { routes[path] = { render, ...opts }; }
const NAV = [["today", "#/today", "Today"], ["week", "#/week", "Week"], ["money", "#/money", "Money"], ["me", "#/me", "Me"], ["more", "#/more", "More"]];

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
  const page = h("div.page");
  app.replaceChildren(page);
  api.resetStale();
  window.scrollTo(0, 0);
  try { await r.render(page, ...args); if (api.isStale && !r.public) page.prepend(offlineNote()); }
  catch (e) { page.replaceChildren(h("div.empty", icon("info"), h("p", e.message || "Could not load."), h("button.btn", { onclick: render }, "Try again"))); }
  dragFab();
  if (!r.public) daily();
}
function navBar(active) {
  return h("nav.nav", { "aria-label": "Main" }, h("div.nav-inner",
    NAV.map(([k, href, label]) => h("a" + (k === active ? ".on" : ""), { href, "aria-current": k === active ? "page" : null }, icon(k), t(label)))));
}
export const rerender = () => render();

// the round ＋ button can be dragged anywhere so it never covers what you want to tap
function dragFab() {
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
  if (!api.LS.get("al_fab_tip")) { api.LS.set("al_fab_tip", 1); setTimeout(() => toast("Tip: hold and drag the ＋ button to move it anywhere."), 1200); }
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

export function start() {
  window.addEventListener("hashchange", render);
  window.addEventListener("online", () => { api.flushQueue().then(r => { if (r.length) { syncToast(r); render(); } }); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && api.getSession()) daily(); });
  const th = api.LS.get("al_theme"); if (th) applyTheme(th);
  render();
}
