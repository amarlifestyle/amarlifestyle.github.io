// Amar Lifestyle — login, registration, password reset, privacy policy
import * as api from "./api.js";
import { h, icon, toast, busy, t } from "./ui.js";
import { route, go, loadBasics, store, occupationPicker, saveOccupation } from "./app.js";
import { religionPicker, saveReligion } from "./prayer.js";
import { aboutContent } from "./more.js";

const field = (label, attrs) => { const i = h("input.input", attrs); return [h("label.f", h("span", label), i), i]; };

function shell(...kids) {
  return h("div.auth", h("img.logo", { src: document.documentElement.dataset.theme === "light" ? "assets/logo-light.png" : "assets/logo-dark.png", alt: "Amar Lifestyle" }), ...kids);
}

route("login", page => {
  const help = h("div");
  const [pf, phone] = field(t("Phone number"), { type: "tel", inputmode: "numeric", autocomplete: "tel", placeholder: "01XXXXXXXXX" });
  const [wf, pass] = field(t("Password"), { type: "password", autocomplete: "current-password" });
  const btn = h("button.btn.primary.block", { type: "submit" }, t("Log in"));
  const form = h("form.card", pf, wf, btn, help,
    h("div.row.between.mt", h("button.linkbtn", { type: "button", onclick: () => go("#/forgot") }, "Forgot password?"),
      h("button.linkbtn", { type: "button", onclick: () => go("#/register") }, t("Create account"))));
  form.addEventListener("submit", e => { e.preventDefault(); login(); });
  let wrong = 0;
  const login = async () => {
    btn.disabled = true;
    try {
      await api.account("login", { phone: phone.value, password: pass.value });
      store.profile = null; await loadBasics(); go("#/today");
    } catch (e) {
      sessionStorage.setItem("al_last_phone", phone.value);
      if (e.code === "wrong_password") wrong++;
      help.replaceChildren(h("div.card", { style: { borderColor: "color-mix(in srgb, var(--red) 55%, transparent)", marginTop: "10px" } },
        h("b.bad", e.message), h("p.small.muted", { style: { margin: "4px 0 8px" } },
          e.code === "no_account" ? "Check the number, or make a new account." : wrong >= 2 ? "Forgot it? Get a code on Telegram and set a new one." : "Check your password, or reset it."),
        e.code === "no_account" ? h("a.btn.small.primary", { href: "#/register" }, t("Create account")) : h("a.btn.small" + (wrong >= 2 ? ".primary" : ""), { href: "#/forgot" }, "Forgot password?")));
    } finally { btn.disabled = false; }
  };
  page.append(shell(h("p.tag", "Build a disciplined life, one task at a time."), form,
    h("p.center.small.faint", h("a", { href: "#/home" }, "← Welcome page"), " · ", h("a", { href: "#/privacy" }, "Privacy Policy"))));
}, { public: true });

route("register", page => {
  const [nf, name] = field("Your name", { autocomplete: "name", placeholder: "e.g. Musfiqur Rahman" });
  const [pf, phone] = field(t("Phone number") + " (you log in with this)", { type: "tel", inputmode: "numeric", placeholder: "01XXXXXXXXX" });
  const [ef, email] = field("Email", { type: "email", autocomplete: "email", placeholder: "you@gmail.com" });
  const [wf, pass] = field("Password (at least 6 characters)", { type: "password", autocomplete: "new-password" });
  const agree = h("input", { type: "checkbox", id: "agree" });
  const btn = h("button.btn.primary.block", { type: "submit" }, t("Create account"));
  let occ = null;
  const occf = h("label.f", h("span", "What do you do?"), occupationPicker(null, k => occ = k));
  let rel = null;
  const relf = h("label.f", h("span", "Religion (Muslim → prayer times & tracking)"), religionPicker(null, k => rel = k));
  const form = h("form.card", nf, pf, ef, wf, occf, relf,
    h("p.hint", "Your data will be safely stored in backup files."),
    h("label.check", { for: "agree" }, agree, h("span", "I agree to the ", h("a", { href: "#/privacy", target: "_blank" }, "Privacy Policy and Terms of Use"), ".")),
    btn,
    h("div.center.mt", h("button.linkbtn", { type: "button", onclick: () => go("#/login") }, "I already have an account")));
  form.addEventListener("submit", e => { e.preventDefault(); reg(); });
  const reg = busy(btn, async () => {
    if (!agree.checked) throw new Error("Please tick “I agree” to continue.");
    await api.account("register", { name: name.value, phone: phone.value, email: email.value, password: pass.value, agree: "yes" });
    store.profile = null; await loadBasics();
    if (occ) { try { await saveOccupation(occ); } catch { /* can set later in Settings */ } }
    if (rel) { try { await saveReligion(rel); } catch { /* can set later in Settings */ } }
    toast("Welcome to Amar Lifestyle! 🎉", "ok");
    go("#/welcome");
  });
  page.append(shell(form));
}, { public: true });

// one form for "forgot password" (logged out) and "forgot PIN" (logged in): code by Telegram or email
export function codeResetForm(target, phoneInput, done) {
  const isPin = target === "pin";
  const [cf, code] = field("6-digit code from Telegram", { inputmode: "numeric", maxlength: "8", placeholder: "123456", autocomplete: "one-time-code" });
  const [nf, nv] = isPin ? field("New 4-digit PIN", { type: "password", inputmode: "numeric", maxlength: "4" }) : field("New password (at least 6 characters)", { type: "password", autocomplete: "new-password" });
  const save = h("button.btn.primary.block", isPin ? "Save new PIN" : "Save new password");
  const stage2 = h("div", { style: { display: "none" } }, cf, nf, save);
  const send = h("button.btn.block", "Send code to my Telegram");
  send.onclick = busy(send, async () => {
    const phone = phoneInput?.value;
    if (!isPin && !phone) throw new Error("Write your phone number first.");
    const r = isPin ? await api.telegram("pin_request", {}, { auth: true }) : await api.telegram("reset_request", { phone });
    if (r?.linked === false) throw new Error("No account with this phone number.");
    toast("Code sent to your Telegram ✓", "ok");
    stage2.style.display = ""; send.textContent = "Send again"; code.focus();
  });
  save.onclick = busy(save, async () => {
    const c = code.value.trim();
    isPin ? await api.telegram("pin_confirm", { code: c, pin: nv.value }, { auth: true }) : await api.telegram("reset_confirm", { phone: phoneInput.value, code: c, password: nv.value });
    toast(isPin ? "PIN changed ✓" : "Password changed ✓ Please log in.", "ok");
    done?.();
  });
  return h("div", h("p.hint", "A 6-digit code comes to the Telegram you connected in Settings → Telegram."), send, h("div.mt", stage2),
    h("p.small.faint.mt.mb0", "Telegram not connected? Message the Admin: ", h("a", { href: "https://www.facebook.com/engrmusfiqur", target: "_blank", rel: "noopener" }, "facebook.com/engrmusfiqur")));
}

route("forgot", page => {
  const [pf, phone] = field(t("Phone number"), { type: "tel", inputmode: "numeric", placeholder: "01XXXXXXXXX", value: sessionStorage.getItem("al_last_phone") || "" });
  page.append(shell(h("div.card", h("h2", "Forgot password"), pf, codeResetForm("password", phone, () => go("#/login")),
    h("div.center.mt", h("button.linkbtn", { onclick: () => go("#/login") }, "Back to login")))));
}, { public: true });

route("newpass", page => {
  const token = sessionStorage.getItem("al_recovery");
  const [wf, pass] = field("New password", { type: "password", autocomplete: "new-password" });
  const btn = h("button.btn.primary.block", "Save new password");
  btn.onclick = busy(btn, async () => {
    if (pass.value.length < 6) throw new Error("Password must be at least 6 characters.");
    await api.setNewPassword(token, pass.value);
    sessionStorage.removeItem("al_recovery");
    toast("Password changed. Please log in.", "ok"); go("#/login");
  });
  page.append(shell(h("div.card", h("h2", "Set a new password"), token ? [wf, btn] : h("p.muted", "This link is not valid any more."))));
}, { public: true });

// ---------- Privacy Policy (formal, article style)
const POLICY = [
  ["Article 1 — Definitions", "In this Policy, “Amar Lifestyle” or the “Service” means the Amar Lifestyle website and application; “User” means any person who creates an account; “Data” means any information a User provides to or generates within the Service; and “Administrators” means persons authorised by Amar Lifestyle to operate and maintain the Service."],
  ["Article 2 — Information Collected", "The Service collects the information a User provides at registration (name, phone number, email address and password) and the information a User records while using the Service, including tasks, routines, time records, photographs submitted as proof, financial entries, budgets, notes, diary entries and related activity records, together with technical information necessary for the Service to function."],
  ["Article 3 — Purpose of Use", "Data is used to provide the features of the Service, including scoring, levels, reports and reminders; to maintain the accuracy and integrity of records; to protect the Service and its Users; to provide support; and to improve the Service. Aggregated information that does not identify any individual may be used to understand and improve how the Service is used."],
  ["Article 3A — Artificial Intelligence", "To provide suggestions, alerts and routine planning, summarised usage information (such as routines, task records, category totals and financial totals) may be processed by a third-party artificial intelligence service acting on behalf of Amar Lifestyle. Names, phone numbers, email addresses, diary entries and photographs are not shared for this purpose. AI output is advisory; nothing is saved without the User's confirmation."],
  ["Article 4 — Storage and Backup", "Data is stored on secured servers and is regularly preserved in backup files to prevent loss. Backups may be retained for as long as is reasonably necessary for the operation, security and continuity of the Service."],
  ["Article 5 — Access to Data", "Access to stored Data, including backups, is limited to authorised Administrators of Amar Lifestyle and is exercised for the purposes of security, verification of records, technical support, resolution of disputes and maintenance of the Service. Such access is recorded."],
  ["Article 6 — Integrity of Financial Records", "Financial entries may be amended only within the period permitted by the Service. Every amendment is permanently recorded in an edit history, and reports generated by the Service disclose such amendments. Reports carry a unique identifier and a verification code by which their authenticity may be confirmed. Administrators may correct records where necessary, and any such correction is likewise recorded and disclosed."],
  ["Article 7 — Visibility to Other Users", "Other Users may view only those parts of a User’s profile that the User has chosen to make public. Financial entries, diary entries and photographs are never shown to other Users."],
  ["Article 8 — Rights and Responsibilities of Users", "Users are responsible for the accuracy of the information they record and for keeping their password and PIN confidential. Users may request a copy of their Data or the closure of their account by contacting Amar Lifestyle. Misuse of the Service, including attempts to falsify records, may result in suspension of the account."],
  ["Article 9 — Changes to this Policy", "Amar Lifestyle may amend this Policy from time to time. Continued use of the Service after an amendment constitutes acceptance of the amended Policy."],
  ["Article 10 — Contact", "Questions about this Policy may be directed to Amar Lifestyle through the contact links on the About Us page."],
];
route("privacy", page => {
  page.append(h("header.topbar", h("div.row", h("a.icon-btn", { href: api.getSession() ? "#/more" : "#/register", "aria-label": "Back" }, icon("back")), h("h1", "Privacy Policy"))),
    h("div.card", h("p.small.muted", "Privacy Policy and Terms of Use of Amar Lifestyle. Effective from 1 November 2026."),
      POLICY.map(([a, b]) => [h("h3", { style: { margin: "16px 0 6px", fontSize: "15px" } }, a), h("p.small", { style: { margin: 0 } }, b)])));
}, { public: true });

// ---------- welcome page for visitors (not logged in)
route("home", page => {
  if (api.getSession()) return go("#/today");
  const feat = (ic, title, text) => h("div.card", { style: { marginBottom: 0 } }, h("div.row", { style: { gap: "10px", alignItems: "flex-start" } },
    h("div.ic", { style: { width: "34px", height: "34px", minWidth: "34px", borderRadius: "10px", background: "var(--card2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand)", flexShrink: 0 } }, icon(ic)),
    h("div", h("b", title), h("div.small.muted", text))));
  const cta = () => h("div.row", { style: { gap: "10px" } },
    h("a.btn.primary.grow", { href: "#/register" }, t("Create account")), h("a.btn.grow", { href: "#/login" }, t("Log in")));
  page.append(
    h("div", { style: { textAlign: "center", padding: "28px 0 18px" } },
      h("img", { src: document.documentElement.dataset.theme === "light" ? "assets/logo-light.png" : "assets/logo-dark.png", alt: "Amar Lifestyle", style: { width: "230px", margin: "0 auto 14px" } }),
      h("h1", { style: { fontSize: "26px", margin: "0 0 6px", letterSpacing: "-0.5px" } }, "Welcome to Amar Lifestyle"),
      h("p.muted", { style: { margin: "0 auto 18px", maxWidth: "460px" } }, "Plan your day, keep your routine, earn Discipline Points and see your progress — free for everyone."),
      h("div", { style: { maxWidth: "420px", margin: "0 auto" } }, cta())),
    h("div.section-title", h("h2", "What you can do")),
    h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "10px" } },
      feat("routine", "Daily & weekly routine", "Set tasks once — they repeat every week. Build your week like a neon routine chart."),
      feat("medal", "Discipline Points & levels", "Hard tasks earn more DP. Climb Bronze → Silver → Gold → Platinum → Diamond every month."),
      feat("timer", "Timer & Pomodoro", "Track study, tuition and gym time. 25 + 5 focus sessions."),
      feat("money", "Money & budget", "Income, expenses, budgets and savings. Locked edit history keeps records honest."),
      feat("student", "Tuition manager", "Students, fees, attendance and month-by-month graphs."),
      feat("report", "Reports with QR", "PDF reports anyone can verify by scanning the QR code."),
      feat("heart", "Daily life", "Sleep, water, habits, mood and a private diary."),
      feat("mic", "Voice", "Say “Saturday 5 pm tuition 1 hour every week” and it's added."),
      feat("today", "Works offline", "No internet? Keep marking tasks — it syncs when you're back online.")),
    h("div.section-title", h("h2", t("About Us"))),
    aboutContent(),
    h("div.card.center", h("h3", "Ready to build a disciplined life?"), cta()),
    h("p.center.small.faint", h("a", { href: "#/privacy" }, "Privacy Policy"), " · Amar Lifestyle"));
}, { public: true });
