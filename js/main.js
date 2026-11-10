/* © 2026 Musfiqur Rahman. All rights reserved. Unauthorized copying is prohibited. Proprietary — see LICENSE. */
// Amar Lifestyle — entry point
import { start } from "./app.js";
import "./auth.js";
import "./today.js";
import "./week.js";
import "./money.js";
import "./me.js";
import "./more.js";
import "./timetable.js";
import "./exams.js";
import "./dayreport.js";
import "./period.js";
import "./syllabus.js";
import "./notes.js";
import "./install.js"; // catches the one-tap install offer early

// password-reset link from email arrives as #access_token=...&type=recovery
const hp = new URLSearchParams(location.hash.replace(/^#/, ""));
if (hp.get("type") === "recovery" && hp.get("access_token")) {
  sessionStorage.setItem("al_recovery", hp.get("access_token"));
  history.replaceState(null, "", location.pathname + "#/newpass");
}

if ("serviceWorker" in navigator) {
  // always pick up the newest version: check on open / when coming back, and reload once a new one takes over
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  // a new version took over: switch at once only if the app was just opened and nothing was tapped yet,
  // otherwise when the user leaves the app (so it never reloads in the middle of something)
  const t0 = Date.now(); let touched = false;
  addEventListener("pointerdown", () => { touched = true; }, { once: true, capture: true });
  const reloadNow = () => { if (!reloaded) { reloaded = true; location.reload(); } };
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) return;
    if (!touched && Date.now() - t0 < 4000) return reloadNow();
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") reloadNow(); });
  });
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(reg => {
    reg.update().catch(() => {});
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); });
  }).catch(() => {}));
}
import { autoIconize } from "./ui.js";
start();
autoIconize(); // emoji → clean line icons everywhere
