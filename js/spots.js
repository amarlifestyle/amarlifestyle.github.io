// Amar Lifestyle — "where is it?" marks: highlight each part of the screen with a short note
import * as api from "./api.js";
import { h } from "./ui.js";

const TODAY = [
  [".nav-ai", "AI", "প্রশ্ন করুন বা বলুন কী করতে হবে — টাস্ক, টাকা, রুটিন, পরীক্ষা।"],
  [".top-bell", "Alerts", "নোটিফিকেশন চালু করা, Telegram, আর নতুন নোটিফিকেশন।"],
  ["a.hero.mini", "আজকের রিপোর্ট", "চাপলে আজকের পুরো হিসাব আর AI-এর মূল্যায়ন।"],
  [".upnext", "Up next", "পরের কাজ আর কত সময় বাকি।"],
  [".btn.emg", "Emergency", "হঠাৎ জরুরি কাজ যোগ করুন।"],
  [".fab", "নতুন টাস্ক", "একবারের কাজ যোগ করুন।"],
  [".nav", "নিচের মেনু", "Routine · Money · Me — আর মাঝে AI।"],
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
