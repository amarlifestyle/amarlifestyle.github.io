// Amar Lifestyle — Admin panel (hidden link). Every action is checked again on the server.
import * as api from "../js/api.js";
import { h, icon, toast, sheet, confirmBox, busy, askPin, tk, fmtDate } from "../js/ui.js";

const app = document.getElementById("app");
try { if (JSON.parse(localStorage.getItem("al_theme")) === "light") document.documentElement.dataset.theme = "light"; } catch {}
let tab = "overview";
const UNLOCK_KEY = "al_admin_ok";

async function boot() {
  if (!api.getSession()) return app.replaceChildren(h("div.auth", h("div.card", h("h2", "Admin"), h("p.muted", "Please log in to Amar Lifestyle first with the admin account."), h("a.btn.primary.block", { href: "../#/login" }, "Go to login"))));
  let ok = false;
  try { ok = await api.rpc("is_admin"); } catch {}
  if (!ok) return app.replaceChildren(h("div.auth", h("div.card.empty", icon("lock"), h("h2", "Not allowed"), h("p", "This page is for Amar Lifestyle administrators only."), h("a.btn", { href: "../" }, "Back to Amar Lifestyle"))));
  // second step: PIN (Telegram code will be added when the bot is ready)
  const last = Number(sessionStorage.getItem(UNLOCK_KEY) || 0);
  if (Date.now() - last > 30 * 60000) {
    const pin = await askPin("Admin check: enter your PIN.");
    if (!pin) return app.replaceChildren(h("div.auth", h("div.card.empty", h("p", "Cancelled."), h("button.btn", { onclick: boot }, "Try again"))));
    try { await api.rpc("check_pin", { p_pin: pin }); } catch (e) { toast(e.message, "bad"); return boot(); }
    sessionStorage.setItem(UNLOCK_KEY, Date.now());
  }
  render();
}

function render() {
  const tabs = [["overview", "Overview"], ["requests", "Edit requests"], ["users", "Users"], ["rules", "Rules"], ["announce", "Announce"], ["verify", "Verify report"], ["apk", "APK"], ["logs", "Logs"]];
  const body = h("div");
  app.replaceChildren(
    h("header.topbar", h("div.brandmark", h("img", { src: "../assets/icon-64.png", width: 30, alt: "", style: { borderRadius: "8px" } }), h("span", "Amar ", h("b", "Lifestyle"), h("span.muted", " · Control"))), h("a.btn.small", { href: "../" }, "Open app")),
    h("div.tabs", tabs.map(([k, l]) => h("button" + (k === tab ? ".on" : ""), { onclick: () => { tab = k; render(); } }, l))), body);
  ({ overview, requests, users, rules, announce, verify, apk, logs })[tab](body).catch(e => body.replaceChildren(h("div.card.bad", e.message)));
}

async function overview(b) {
  const o = await api.rpc("admin_overview");
  const tile = (k, v) => h("div.stat", h("div.k", k), h("div.v", v));
  b.append(h("div.grid3", tile("Users", o.users), tile("New (7 days)", o.new_7d), tile("Blocked", o.blocked)),
    h("div.grid3.mt", tile("Tasks today", o.tasks_today), tile("Done today", o.done_today), tile("Reports", o.reports)),
    h("p.hint.mt", "Money entries in total: " + o.entries));
}

async function requests(b) {
  const list = await api.rpc("admin_requests");
  if (!list.length) { b.append(h("div.card.small.muted", "No special edit requests yet. Users can ask for one when a money entry is locked.")); return; }
  list.forEach(r => {
    const note = h("input.input", { placeholder: "Note to the user (optional)" });
    const doDecide = async ok => {
      if (!(await confirmBox(ok ? "Approve this edit?" : "Reject this request?", ok ? `${tk(r.old_amount)} → ${tk(r.new_amount)}. It will show as “Special edit” in history and reports.` : "Nothing will change.", ok ? "Approve" : "Reject", !ok))) return;
      await api.rpc("admin_decide_request", { p_id: r.id, p_approve: ok, p_note: note.value || null }); toast(ok ? "Approved ✓" : "Rejected", ok ? "ok" : ""); render();
    };
    const a = h("button.btn.small.primary", "Approve"), rj = h("button.btn.small.danger", "Reject");
    a.onclick = busy(a, () => doDecide(true)); rj.onclick = busy(rj, () => doDecide(false));
    b.append(h("div.card",
      h("div.row.between", h("b", r.user), h("span.badge" + (r.status === "approved" ? ".ok" : r.status === "rejected" ? ".bad" : ".warn"), r.status)),
      h("div.small.muted", `${r.phone} · ${r.kind} · ${r.category} · ${r.entry_date}${r.note ? " · " + r.note : ""}`),
      h("p", { style: { margin: "8px 0" } }, h("b", `${tk(r.old_amount)} → ${tk(r.new_amount)}`)),
      h("p.small", { style: { margin: "0 0 8px" } }, "Reason: ", r.reason),
      r.status === "pending" ? [note, h("div.row.mt", { style: { gap: "8px" } }, a, rj)] : h("div.small.faint", `Decided ${new Date(r.decided_at).toLocaleString("en-GB")}${r.admin_note ? " · " + r.admin_note : ""}`)));
  });
}

async function users(b) {
  const list = await api.rpc("admin_users");
  b.append(h("div.list", list.map(u => h("div.li",
    h("div.grow", h("b", u.name, u.is_admin ? " (admin)" : "", u.blocked ? h("span.bad", " · blocked") : null),
      h("div.small.muted", `${u.phone} · ${u.email}`), h("div.small.muted", `${u.level} · ${u.month_dp} DP this month · joined ${fmtDate(u.created_at.slice(0, 10))}`)),
    h("div.row", { style: { flexDirection: "column", gap: "6px" } },
      h("button.btn.small", { onclick: () => dataCheck(u) }, "Data"),
      u.is_admin ? null : h("button.btn.small" + (u.blocked ? "" : ".danger"), { onclick: async () => {
        if (!(await confirmBox(u.blocked ? "Unblock user?" : "Block user?", u.blocked ? `${u.name} can use Amar Lifestyle again.` : `${u.name} won't be able to log in.`, u.blocked ? "Unblock" : "Block", !u.blocked))) return;
        try { await api.rpc("admin_set_blocked", { p_user: u.id, p_blocked: !u.blocked }); toast("Done ✓", "ok"); render(); } catch (e) { toast(e.message, "bad"); }
      } }, u.blocked ? "Unblock" : "Block"))))));
}

async function dataCheck(u) {
  const d = await api.rpc("admin_user_data", { p_user: u.id });
  const dl = h("button.btn.block", icon("download"), "Download all data (JSON)");
  dl.onclick = () => { const a = h("a", { download: `amar-lifestyle-${u.phone}-${new Date().toISOString().slice(0, 10)}.json`, href: URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: "application/json" })) }); a.click(); };
  const fin = h("div.list", d.finance.slice(0, 50).map(f => h("div.li",
    h("div.grow", h("b", (f.kind === "income" ? "+" : "−") + tk(f.amount)), h("div.small.muted", `${f.entry_date} · ${f.category}${f.note ? " · " + f.note : ""}${f.edit_count ? ` · edited ×${f.edit_count}` : ""}`)),
    h("button.btn.small", { onclick: () => adminEdit(f, u) }, icon("edit")))));
  sheet(`Data · ${u.name}`, h("div",
    h("p.hint", "This look is recorded in the admin log."),
    h("div.grid3", h("div.stat", h("div.k", "Tasks"), h("div.v", d.tasks.length)), h("div.stat", h("div.k", "Money entries"), h("div.v", d.finance.length)), h("div.stat", h("div.k", "Diary days"), h("div.v", d.life_logs.filter(x => x.diary).length))),
    h("h3.mt", "Money entries (latest 50)"), d.finance.length ? fin : h("p.muted", "None."),
    h("h3", "Everything"), h("pre.json", JSON.stringify({ profile: d.profile, stats: d.stats }, null, 2)), dl));
}

async function adminEdit(f, u) {
  const amt = h("input.input", { type: "number", inputmode: "decimal", value: f.amount });
  const note = h("input.input", { value: f.note || "" });
  const ok = await sheet("Admin edit", [h("p.hint", "Works even on locked entries. It will show as “Special edit (approved by Admin)” in history and reports."), h("label.f", h("span", "Amount (৳)"), amt), h("label.f", h("span", "Note"), note)], {
    actions: close => [h("button.btn", { onclick: () => close(null) }, "Cancel"), h("button.btn.primary", { onclick: () => close(true) }, "Save")] });
  if (!ok) return;
  try { await api.rpc("admin_edit_finance", { p_entry: f.id, p_amount: Number(amt.value), p_note: note.value }); toast("Special edit saved ✓", "ok"); document.querySelector(".backdrop")?.remove(); dataCheck(u); }
  catch (e) { toast(e.message, "bad"); }
}

async function rules(b) {
  const rows = await api.select("app_config", "select=key,value");
  const cfg = Object.fromEntries(rows.map(r => [r.key, r.value]));
  const save = async (key, value) => { try { await api.rpc("admin_set_config", { p_key: key, p_value: value }); toast("Saved ✓", "ok"); } catch (e) { toast(e.message, "bad"); } };

  const catInputs = Object.entries(cfg.categories).map(([n, v]) => [n, h("input.input", { type: "number", min: "1", value: v.dp }), h("input.input", { type: "color", value: v.color, style: { padding: "4px", width: "60px" } })]);
  const sc = h("button.btn.primary.block", "Save categories");
  sc.onclick = () => save("categories", Object.fromEntries(catInputs.map(([n, d, c]) => [n, { dp: Number(d.value) || 1, color: c.value }])));
  b.append(h("div.card", h("h3", "DP per hour by category"), catInputs.map(([n, d, c]) => h("div.row", { style: { marginBottom: "8px" } }, h("span.grow", n), h("div", { style: { width: "90px" } }, d), c)), sc));

  const lvInputs = cfg.levels.map(l => [l.name, h("input.input", { type: "number", min: "0", value: l.min })]);
  const sl = h("button.btn.primary.block", "Save levels");
  sl.onclick = () => save("levels", lvInputs.map(([n, i]) => ({ name: n, min: Number(i.value) || 0 })).sort((a, b) => a.min - b.min));
  b.append(h("div.card", h("h3", "Levels (monthly DP needed)"), lvInputs.map(([n, i]) => h("div.row", { style: { marginBottom: "8px" } }, h("span.grow", n), h("div", { style: { width: "120px" } }, i))), sl));

  const nums = [["custom_category_dp", "DP/hour for users' own categories"], ["photo_bonus_dp", "Photo proof bonus DP"], ["late_window_min", "Full DP window after a task ends (minutes)"],
    ["unlock_fraction", "Buttons open after this part of the task (0.75 = last quarter)"], ["finance_edit_grace_days", "Money edit days into next month"], ["streak_threshold", "Streak needs this share of tasks done (0.8 = 80%)"]];
  b.append(h("div.card", h("h3", "Other rules"), nums.map(([k, l]) => {
    const i = h("input.input", { type: "number", step: "any", value: cfg[k] });
    return h("label.f", h("span", l), h("div.row", h("div.grow", i), h("button.btn.small", { onclick: () => save(k, Number(i.value)) }, "Save")));
  })));
}

async function announce(b) {
  const title = h("input.input", { placeholder: "e.g. New feature!" });
  const body = h("textarea.input", { placeholder: "Message for all users" });
  const send = h("button.btn.primary.block", icon("bell"), "Send to everyone");
  send.onclick = busy(send, async () => {
    if (!title.value.trim() || !body.value.trim()) throw new Error("Write a title and message.");
    await api.rpc("admin_announce", { p_title: title.value.trim(), p_body: body.value.trim() }); toast("Sent ✓ — shows on everyone's Today page", "ok"); title.value = body.value = "";
  });
  const list = await api.select("announcements", "select=*&order=created_at.desc&limit=20");
  b.append(h("div.card", h("h3", "New announcement"), h("label.f", h("span", "Title"), title), h("label.f", h("span", "Message"), body), send),
    list.length ? h("div.list", list.map(a => h("div.li", h("div.grow", h("b", a.title), h("div.small.muted", a.body), h("div.small.faint", new Date(a.created_at).toLocaleString("en-GB")))))) : null);
}

async function verify(b) {
  const id = h("input.input", { placeholder: "Paste Report ID" });
  const out = h("div");
  const go = h("button.btn.primary.block", "Check");
  go.onclick = busy(go, async () => {
    const r = await api.rpc("verify_report", { p_id: id.value.trim() });
    out.replaceChildren(r ? h("div.card", h("h3.ok", "✓ Real report"), h("p", `${r.snapshot.name} · ${r.title}`), h("p.small.muted", `Income ${tk(r.snapshot.income)} · Expense ${tk(r.snapshot.expense)} · made ${new Date(r.created_at).toLocaleString("en-GB")}`), h("a.btn.block", { href: `../#/verify/${r.id}`, target: "_blank" }, "Open full report"))
      : h("div.card", h("h3.bad", "✗ Not found"), h("p", "No report with this ID — the document may be fake.")));
  });
  b.append(h("div.card", h("h3", "Check a report"), h("p.hint", "Or scan the QR code on the report with any phone camera."), id, h("div.mt", go)), out);
}

async function apk(b) {
  const inp = h("input.input", { type: "file", accept: ".apk" });
  const up = h("button.btn.primary.block", icon("download"), "Upload new APK");
  up.onclick = busy(up, async () => { if (!inp.files[0]) throw new Error("Choose the APK file."); await api.uploadApk(inp.files[0]); toast("Uploaded ✓ — the Download button now gives this version", "ok"); });
  b.append(h("div.card", h("h3", "Android app"), h("p.hint", "Upload a new APK. Users get it from More → Get the app."), inp, h("div.mt", up)));
}

async function logs(b) {
  const l = await api.rpc("admin_logs", { p_limit: 100 });
  b.append(l.length ? h("div.list", l.map(x => h("div.li", h("div.grow", h("b", x.action), h("div.small.muted", new Date(x.at).toLocaleString("en-GB"), x.target_user ? " · user " + x.target_user.slice(0, 8) : ""), x.detail ? h("div.small.faint", JSON.stringify(x.detail)) : null))))
    : h("div.card.small.muted", "No admin actions yet."));
}

boot();
