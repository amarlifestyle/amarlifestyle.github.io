/* © 2026 Musfiqur Rahman. All rights reserved. Unauthorized copying is prohibited. Proprietary — see LICENSE. */
// Amar Lifestyle — "add to Home Screen" first: the app works best (and iPhone notifications only work) when opened from the home screen
import * as api from "./api.js";
import { h, sheet, toast } from "./ui.js";

let bip = null; // Android/Chrome one-tap install
addEventListener("beforeinstallprompt", e => { e.preventDefault(); bip = e; });
addEventListener("appinstalled", () => { bip = null; api.LS.set("al_installed", 1); toast("App added to your home screen ✓", "ok"); });

export const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const ua = navigator.userAgent;
export const device = () => {
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
  const inApp = /FBAN|FBAV|FB_IAB|Instagram|Messenger|Line\/|wv\)/.test(ua);
  return { ios, android: /Android/.test(ua), inApp, iosOther: ios && /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua), canPrompt: !!bip };
};

function steps(title, list) {
  return h("div.inst-steps", h("b", title), h("ol", list.map(l => h("li", l))));
}

// what to do on this phone, in a few big steps
export function installBody(page = false) {
  const d = device();
  const out = [];
  if (d.inApp) {
    out.push(steps("Opened inside Facebook / Messenger", [
      d.ios ? "Tap ⋯ or ↗ → “Open in Safari”" : "Tap ⋮ → “Open in Chrome”",
      "Then add it to the Home Screen from there."]));
    out.push(h("button.btn.block", { onclick: () => navigator.clipboard?.writeText(api.SITE_URL).then(() => toast("Link copied ✓", "ok")) }, "🔗 Copy link"));
  } else if (d.ios) {
    if (d.iosOther) out.push(h("p.hint", "On iPhone this works only in Safari. Open the link in Safari."),
      h("button.btn.block", { onclick: () => navigator.clipboard?.writeText(api.SITE_URL).then(() => toast("Link copied — paste it in Safari", "ok")) }, "🔗 Copy link"));
    out.push(steps("iPhone / iPad (Safari)", ["Tap Share (square with ⬆ arrow)", "Scroll down → “Add to Home Screen”", "Tap “Add”", "Open Amar Lifestyle from the Home Screen"]));
  } else if (bip) {
    const b = h("button.btn.primary.block", "Install app");
    b.onclick = async () => { const p = bip; if (!p) return; p.prompt(); const r = await p.userChoice.catch(() => ({})); if (r.outcome === "accepted") { bip = null; b.closest(".backdrop")?.click(); } };
    out.push(b);
  } else {
    out.push(steps(d.android ? "Android (Chrome)" : "Computer (Chrome / Edge)", d.android
      ? ["Tap ⋮ (top right)", "Tap “Install app” / “Add to Home screen”", "Tap “Install”"]
      : ["Click the install icon in the address bar", "Click “Install”"]));
  }
  if (page) return out;
  return [h("div.inst-why",
    h("div", "⚡ Opens full screen in one tap"),
    h("div", "🔔 Reliable reminders", d.ios ? h("b", " (required on iPhone)") : null),
    h("div", "📴 Works offline")), ...out];
}

export function showInstall() {
  api.LS.set("al_inst_seen", Date.now());
  return sheet("📱 Add to Home Screen", installBody(), { actions: close => [h("button.btn.block", { onclick: () => close(null) }, "Later")] });
}
// shown before everything else, again every day until it's done
export async function installFirst() {
  if (isStandalone() || api.LS.get("al_installed") && !device().ios) return;
  if (Date.now() - (api.LS.get("al_inst_seen") || 0) < 20 * 3600e3) return;
  await showInstall();
}
// small strip on Today while the app is still in a browser tab
export function installStrip() {
  if (isStandalone() || Date.now() - (api.LS.get("al_inst_strip") || 0) < 864e5) return null;
  const c = h("div.tg-hint", { style: { marginBottom: "10px", alignItems: "center", borderColor: "color-mix(in srgb, var(--brand) 45%, transparent)" } },
    h("span", "📱"), h("span.grow", "Add the app to your Home Screen."),
    h("button.btn.small.primary", { onclick: () => showInstall() }, "Add"),
    h("button.linkbtn.small", { onclick: () => { api.LS.set("al_inst_strip", Date.now()); c.remove(); } }, "✕"));
  return c;
}
