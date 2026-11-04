/* © 2026 Musfiqur Rahman. All rights reserved. Unauthorized copying is prohibited. Proprietary — see LICENSE. */
// Amar Lifestyle — "where is it?" marks: highlight each part of the screen with a short note
import * as api from "./api.js";
import { h } from "./ui.js";

const TODAY = [
  [".nav-ai", "AI", "Ask, or tell it what to do."],
  [".top-bell", "Alerts", "Notifications and Telegram."],
  ["a.hero.mini", "Today's report", "Tap for the full day and AI review."],
  [".upnext", "Up next", "Your next task."],
  [".btn.emg", "Emergency", "Add something urgent."],
  [".fab", "New task", "Add a one-time task."],
  [".nav", "Menu", "Routine · Money · Me, with AI in the middle."],
];

export function showSpots(force = false, list = TODAY) {
  if (!force && api.LS.get("al_spots_v2")) return;
  const items = list.filter(([sel]) => { const el = document.querySelector(sel); return el && el.getBoundingClientRect().height > 0; });
  if (!items.length) return;
  let i = 0;
  const ring = h("div.spot-ring"), tip = h("div.spot-tip");
  const layer = h("div.spot-layer", ring, tip);
  const end = () => { layer.remove(); api.LS.set("al_spots_v2", 1); removeEventListener("resize", place); };
  const place = () => {
    const [sel, title, text] = items[i];
    const el = document.querySelector(sel); if (!el) return next();
    el.scrollIntoView({ block: "center", behavior: "instant" in window ? "instant" : "auto" });
    const r = el.getBoundingClientRect(), pad = 6;
    Object.assign(ring.style, { left: r.left - pad + "px", top: r.top - pad + "px", width: r.width + pad * 2 + "px", height: r.height + pad * 2 + "px" });
    tip.replaceChildren(h("b", title), h("p", text),
      h("div.row.between", h("span.small.muted", `${i + 1}/${items.length}`),
        h("div.row", { style: { gap: "8px" } }, h("button.btn.small", { onclick: end }, "Skip"), h("button.btn.small.primary", { onclick: next }, i === items.length - 1 ? "Done" : "Next"))));
    const below = r.bottom + 180 < innerHeight;
    Object.assign(tip.style, { top: below ? r.bottom + 14 + "px" : "auto", bottom: below ? "auto" : innerHeight - r.top + 14 + "px" });
  };
  const next = () => { i++; if (i >= items.length) end(); else place(); };
  document.body.append(layer);
  addEventListener("resize", place);
  setTimeout(place, 50);
}
