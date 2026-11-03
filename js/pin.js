// Amar Lifestyle — PIN lock for sensitive money parts (editing money, the full tuition sheet, backup)
import * as api from "./api.js";
import { h, sheet, toast, askPin } from "./ui.js";

const opened = {}; // area → when it was unlocked (a short grace so the same screen doesn't ask twice)
export async function setPinFlow() {
  const n1 = await askPin("Choose a new 4-digit PIN"); if (!n1) return false;
  const n2 = await askPin("Type the new PIN again"); if (!n2) return false;
  if (n1 !== n2) { toast("PINs didn't match. Try again.", "bad"); return false; }
  await api.rpc("set_pin", { p_new: n1, p_old: null }); toast("PIN saved ✓", "ok");
  return true;
}
// true = go ahead
export async function pinGate(area, reason = "Enter your PIN") {
  if (Date.now() - (opened[area] || 0) < 90000) return true;
  let has = false;
  try { has = await api.rpc("has_pin"); } catch { return true; } // offline: nothing new can be loaded anyway
  if (!has) {
    if (Date.now() - (api.LS.get("al_pin_skip") || 0) < 7 * 864e5) return true;
    const r = await sheet("🔐 Set a PIN?", [h("p", "Protects money edits, the tuition sheet, reports, habits and backups."),
      h("p.hint.mb0", "Adding new entries never needs it.")], {
      actions: close => [h("button.btn", { onclick: () => close("skip") }, "Later"), h("button.btn.primary", { onclick: () => close("set") }, "Set PIN")],
    });
    if (r === "set") { try { if (await setPinFlow()) opened[area] = Date.now(); } catch (e) { toast(e.message, "bad"); } return true; }
    if (r === "skip") { api.LS.set("al_pin_skip", Date.now()); return true; }
    return false;
  }
  const pin = await askPin(reason + ""); if (!pin) return false;
  try { if (!(await api.rpc("check_pin", { p_pin: pin }))) { toast("Wrong PIN.", "bad"); return false; } } catch (e) { toast(e.message || "Wrong PIN.", "bad"); return false; }
  opened[area] = Date.now();
  return true;
}
export const lockedCard = (onOpen) => h("div.card.empty", h("p", "🔒 Locked"), h("button.btn.primary", { onclick: onOpen }, "Unlock"),
  h("div", { style: { marginTop: "10px" } }, h("a.small", { href: "#/settings" }, "Forgot PIN?")));
