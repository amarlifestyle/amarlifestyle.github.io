// Amar Lifestyle — entry point
import { start } from "./app.js";
import "./auth.js";
import "./today.js";
import "./week.js";
import "./money.js";
import "./me.js";
import "./more.js";

// password-reset link from email arrives as #access_token=...&type=recovery
const hp = new URLSearchParams(location.hash.replace(/^#/, ""));
if (hp.get("type") === "recovery" && hp.get("access_token")) {
  sessionStorage.setItem("al_recovery", hp.get("access_token"));
  history.replaceState(null, "", location.pathname + "#/newpass");
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
start();
