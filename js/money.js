// Amar Lifestyle — money: income, expenses, budgets, history, tuition, dues, savings
import * as api from "./api.js";
import { h, icon, t, toast, sheet, confirmBox, busy, askPin, tk, todayStr, addDays, fmtDate, donut, PALETTE, pad, colorPicker, barChart } from "./ui.js";
import { route, store, rerender, backbar } from "./app.js";

const INCOME_CATS = ["Tuition", "Salary", "Video work", "Gift", "Other income"];
const expCats = () => store.cfg.expense_categories || ["Rent + Bills", "Food + Transport", "Study", "Shopping + Fun + Other"];
const monthStart = s => s.slice(0, 7) + "-01";
const monthEnd = m => { const [y, mo] = m.split("-").map(Number); return `${y}-${pad(mo)}-${pad(new Date(y, mo, 0).getDate())}`; };
const shiftMonth = (m, n) => { const [y, mo] = m.split("-").map(Number); const d = new Date(y, mo - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`; };
export function lockAt(dateStr) {
  const grace = Number(store.cfg.finance_edit_grace_days ?? 5);
  const nm = shiftMonth(monthStart(dateStr), 1);
  return new Date(new Date(`${nm}T00:00:00+06:00`).getTime() + grace * 864e5);
}
const isLocked = d => new Date() >= lockAt(d);
const firstOpenDate = () => { const today = todayStr(); const prev = shiftMonth(monthStart(today), -1); return isLocked(prev) ? monthStart(today) : prev; };
const monthLabel = m => new Date(m + "T00:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" });
const catCol = (c, i) => PALETTE[(expCats().indexOf(c) + 10) % 10] || PALETTE[i % 10];

route("money", async (page, tab = "overview", month) => {
  const m = month || monthStart(todayStr());
  const me = monthEnd(m);
  page.append(h("header.topbar",
    h("div", h("h1", t("Money")), h("div.sub", monthLabel(m))),
    h("div.row", h("a.icon-btn", { href: `#/money/${tab}/${shiftMonth(m, -1)}`, "aria-label": "Previous month" }, icon("back")),
      h("a.icon-btn", { href: `#/money/${tab}/${shiftMonth(m, 1)}`, "aria-label": "Next month" }, icon("chev")))));
  const tabs = [["overview", "Overview"], ["entries", "Entries"], ["tuition", "Tuition"], ["plans", "Dues & Goals"]];
  page.append(h("div.seg", { style: { marginBottom: "14px" } }, tabs.map(([k, l]) => h("button" + (k === tab ? ".on" : ""), { onclick: () => location.hash = `#/money/${k}/${m}` }, l))));
  const body = h("div"); page.append(body);
  page.append(h("button.fab", { onclick: () => addEntry(), "aria-label": "Add money entry" }, icon("plus")));
  if (tab === "overview") await overview(body, m, me);
  else if (tab === "entries") await entries(body, m, me);
  else if (tab === "tuition") await tuition(body, m);
  else await plans(body);
}, { tab: "money" });

async function overview(body, m, me) {
  const [rows, budgets, all] = await Promise.all([
    api.select("finance_entries", `select=kind,category,amount&entry_date=gte.${m}&entry_date=lte.${me}`),
    api.select("budgets", `select=*&month=eq.${m}`),
    api.select("finance_entries", "select=kind,amount"),
  ]);
  const inc = rows.filter(r => r.kind === "income").reduce((s, r) => s + +r.amount, 0);
  const exp = rows.filter(r => r.kind === "expense").reduce((s, r) => s + +r.amount, 0);
  const totalSaved = all.reduce((s, r) => s + (r.kind === "income" ? +r.amount : -r.amount), 0);
  body.append(h("div.grid3",
    h("div.stat", h("div.k", t("Income")), h("div.v.ok", tk(inc))),
    h("div.stat", h("div.k", t("Expense")), h("div.v.bad", tk(exp))),
    h("div.stat", h("div.k", "Saved this month"), h("div.v", tk(inc - exp)))));
  body.append(h("p.small.muted", { style: { margin: "8px 2px 14px" } }, `Total savings (all time): `, h("b", tk(totalSaved)), " = all income − all expenses."));

  // budgets
  const bmap = Object.fromEntries(budgets.map(b => [b.category, +b.amount]));
  const spent = {}; rows.filter(r => r.kind === "expense").forEach(r => spent[r.category] = (spent[r.category] || 0) + +r.amount);
  const cats = [...new Set([...expCats(), ...Object.keys(spent)])];
  const card = h("div.card", h("div.row.between", h("h3.mb0", "Monthly budget"), h("button.btn.small", { onclick: () => setBudgets(m, bmap) }, icon("edit"), "Set")));
  if (!budgets.length) card.append(h("p.hint.mt", "Set a budget for each category. Every expense is subtracted and you'll see how much is left."));
  cats.forEach(c => {
    const b = bmap[c] || 0, s = spent[c] || 0, left = b - s, p = b ? s / b : 0;
    card.append(h("div", { style: { margin: "12px 0" } },
      h("div.row.between.small", h("b", c), b ? h("span" + (left < 0 ? ".bad" : p > 0.8 ? ".warn" : ".muted"), left >= 0 ? `${tk(left)} left (${Math.round((1 - p) * 100)}%)` : `${tk(-left)} over budget`) : h("span.muted", tk(s) + " spent")),
      b ? h("div.bar" + (p > 1 ? ".bad" : p > 0.8 ? ".warn" : ""), { style: { marginTop: "6px" } }, h("i", { style: { width: Math.min(100, p * 100) + "%" } })) : null,
      b ? h("div.small.faint", { style: { marginTop: "3px" } }, `${tk(s)} of ${tk(b)} used`) : null));
  });
  body.append(card);
  if (exp) body.append(h("div.card", h("h3", "Where the money went"),
    donut(cats.filter(c => spent[c]).map((c, i) => ({ l: c, v: spent[c], c: catCol(c, i), fmt: tk(spent[c]) })), { center: tk(exp) })));
  body.append(h("div.list",
    h("a.li", { href: `#/money/entries/${m}` }, h("div.ic", icon("wallet")), h("div.grow", h("b", "All entries"), h("div.small.muted", "See, edit and check history")), icon("chev", "chev")),
    h("button.li", { onclick: fixedCosts }, h("div.ic", icon("routine")), h("div.grow", h("b", "Fixed monthly costs"), h("div.small.muted", "Rent, internet… added automatically")), icon("chev", "chev")),
    h("a.li", { href: "#/reports" }, h("div.ic", icon("report")), h("div.grow", h("b", "Make a report"), h("div.small.muted", "PDF with QR code to prove it's real")), icon("chev", "chev"))));
}

async function entries(body, m, me) {
  const rows = await api.select("finance_entries", `select=*&entry_date=gte.${m}&entry_date=lte.${me}&order=entry_date.desc,created_at.desc`);
  const locked = isLocked(m);
  body.append(h("p.small.muted", locked ? "🔒 This month is locked. Entries can only be viewed."
    : `✏️ Editable until ${lockAt(m).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}. Every edit is saved in history.`));
  if (!rows.length) { body.append(h("div.card.empty", icon("wallet"), h("p", "No entries this month."), h("button.btn.primary", { onclick: () => addEntry() }, icon("plus"), "Add entry"))); return; }
  let last = "";
  const list = h("div.list");
  rows.forEach(r => {
    if (r.entry_date !== last) { last = r.entry_date; list.append(h("div.li.small.muted", { style: { minHeight: "36px", background: "var(--card2)" } }, fmtDate(r.entry_date, { weekday: "short", day: "numeric", month: "short" }))); }
    list.append(h("button.li", { onclick: () => entryDetail(r) },
      h("div.ic", { style: { color: r.kind === "income" ? "var(--green)" : "var(--red)" } }, icon(r.kind === "income" ? "download" : "wallet")),
      h("div.grow", h("b", r.note || r.category), h("div.small.muted", r.category, r.edit_count ? h("span.warn", ` · Edited ×${r.edit_count}${r.admin_edited ? " (Admin)" : ""}`) : null)),
      h("b" + (r.kind === "income" ? ".ok" : ""), (r.kind === "income" ? "+" : "−") + tk(r.amount))));
  });
  body.append(list);
}

async function entryDetail(r) {
  const hist = await api.select("finance_history", `select=*&entry_id=eq.${r.id}&order=edited_at`);
  const locked = isLocked(r.entry_date);
  sheet(r.note || r.category, h("div",
    h("div.big" + (r.kind === "income" ? ".ok" : ""), (r.kind === "income" ? "+" : "−") + tk(r.amount)),
    h("p.muted", `${r.kind === "income" ? "Income" : "Expense"} · ${r.category} · ${fmtDate(r.entry_date, { day: "numeric", month: "long", year: "numeric" })}`),
    h("p.small", locked ? "🔒 Locked — can't be edited any more." : `✏️ Can be edited until ${lockAt(r.entry_date).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.`),
    h("h3", { style: { fontSize: "15px", margin: "14px 0 6px" } }, "History"),
    h("div.small", h("div", `Created: ${tk(r.original_amount)} · ${new Date(r.created_at).toLocaleString("en-GB")}`),
      hist.map((x, i) => h("div", { style: { padding: "4px 0" } }, `Edit ${i + 1}: ${tk(x.old_amount)} → ${tk(x.new_amount)} · ${new Date(x.edited_at).toLocaleString("en-GB")}${x.by_admin ? " · by Admin" : ""}`)),
      !hist.length ? h("div.faint", "Never edited.") : null)), {
    actions: close => [h("button.btn", { onclick: () => close() }, "Close"),
      !locked ? h("button.btn.primary", { onclick: () => { close(); editEntry(r); } }, icon("edit"), "Edit") : null].filter(Boolean),
  });
}

async function editEntry(r) {
  const amt = h("input.input", { type: "number", inputmode: "decimal", min: "0", step: "0.01", value: r.amount });
  const note = h("input.input", { value: r.note || "", maxlength: "120" });
  const ok = await sheet("Edit entry", [h("p.hint", "The old amount stays in history and every report will show “Edited”."),
    h("label.f", h("span", "Amount (৳)"), amt), h("label.f", h("span", "Note"), note)], {
    actions: close => [h("button.btn", { onclick: () => close(null) }, t("Cancel")), h("button.btn.primary", { onclick: () => close(true) }, t("Save"))],
  });
  if (!ok) return;
  const pin = await askPin("Enter your PIN to edit this money entry.");
  if (!pin) return;
  try { await api.rpc("edit_finance", { p_entry: r.id, p_amount: Number(amt.value), p_note: note.value, p_pin: pin }); toast("Saved. History updated ✓", "ok"); rerender(); }
  catch (e) { toast(e.message, "bad"); }
}

export function addEntry(kind = "expense") {
  let k = kind;
  const amt = h("input.input", { type: "number", inputmode: "decimal", min: "0", step: "0.01", placeholder: "0" });
  const cat = h("select.input");
  const fill = () => cat.replaceChildren(...(k === "income" ? INCOME_CATS : expCats()).map(c => h("option", c)));
  fill();
  const seg = h("div.seg", [["expense", t("Expense")], ["income", t("Income")]].map(([v, l]) => h("button" + (v === k ? ".on" : ""), { type: "button", onclick: e => { k = v; fill(); seg.querySelectorAll("button").forEach(b => b.classList.toggle("on", b === e.target)); } }, l)));
  const date = h("input.input", { type: "date", value: todayStr(), max: todayStr(), min: firstOpenDate() });
  const note = h("input.input", { placeholder: "e.g. Rickshaw to campus", maxlength: "120" });
  return sheet("Add money entry", [h("label.f", h("span", "Type"), seg), h("label.f", h("span", "Amount (৳)"), amt), h("label.f", h("span", "Category"), cat),
    h("div.grid2", h("label.f", h("span", "Date"), date), h("label.f", h("span", "Note (optional)"), note))], {
    actions: close => {
      const save = h("button.btn.primary", t("Save"));
      save.onclick = busy(save, async () => {
        const a = Number(amt.value); if (!(a > 0)) throw new Error("Please write the amount.");
        const r = await api.offlineSafe({ kind: "insert", table: "finance_entries", rows: { user_id: api.userId(), kind: k, category: cat.value, amount: a, original_amount: a, note: note.value.trim() || null, entry_date: date.value } });
        toast(r?.queued ? "Saved offline — it will sync when you're online ✓" : "Saved ✓", "ok"); close(true); rerender();
      });
      return [h("button.btn", { onclick: () => close(null) }, t("Cancel")), save];
    },
  });
}

async function setBudgets(m, bmap) {
  const inputs = expCats().map(c => [c, h("input.input", { type: "number", inputmode: "decimal", min: "0", value: bmap[c] || "", placeholder: "0" })]);
  const ok = await sheet(`Budget · ${monthLabel(m)}`, [h("p.hint", "How much can you spend on each this month?"), inputs.map(([c, i]) => h("label.f", h("span", c + " (৳)"), i))], {
    actions: close => [h("button.btn", { onclick: () => close(null) }, t("Cancel")), h("button.btn.primary", { onclick: () => close(true) }, t("Save"))],
  });
  if (!ok) return;
  try { await api.upsert("budgets", inputs.map(([c, i]) => ({ user_id: api.userId(), month: m, category: c, amount: Number(i.value) || 0 })), "user_id,month,category"); toast("Budget saved ✓", "ok"); rerender(); }
  catch (e) { toast(e.message, "bad"); }
}

async function fixedCosts() {
  const rows = await api.select("recurring_costs", "select=*&order=day_of_month");
  const title = h("input.input", { placeholder: "e.g. House rent" });
  const amt = h("input.input", { type: "number", inputmode: "decimal", min: "0", placeholder: "0" });
  const cat = h("select.input", expCats().map(c => h("option", c)));
  const day = h("input.input", { type: "number", min: "1", max: "28", value: "1" });
  sheet("Fixed monthly costs", close => h("div",
    h("p.hint", "These are added to your expenses automatically every month on the day you choose."),
    rows.length ? h("div.list", rows.map(r => h("div.li", h("div.grow", h("b", r.title), h("div.small.muted", `${tk(r.amount)} · ${r.category} · every month on day ${r.day_of_month}`)),
      h("button.btn.small" + (r.active ? "" : ".ghost"), { onclick: async () => { await api.update("recurring_costs", `id=eq.${r.id}`, { active: !r.active }); toast(r.active ? "Paused" : "Turned on"); close(); fixedCosts(); } }, r.active ? "On" : "Off")))) : null,
    h("h3", { style: { fontSize: "15px" } }, "Add new"), h("label.f", h("span", "Name"), title),
    h("div.grid2", h("label.f", h("span", "Amount (৳)"), amt), h("label.f", h("span", "Day of month"), day)), h("label.f", h("span", "Category"), cat),
    (() => { const b = h("button.btn.primary.block", icon("plus"), "Add"); b.onclick = busy(b, async () => {
      if (!title.value.trim() || !(Number(amt.value) > 0)) throw new Error("Write a name and amount.");
      await api.insert("recurring_costs", { user_id: api.userId(), title: title.value.trim(), amount: Number(amt.value), category: cat.value, day_of_month: Math.min(28, Math.max(1, Number(day.value) || 1)) });
      await api.rpc("apply_recurring"); toast("Added ✓", "ok"); close(); rerender();
    }); return b; })()));
}

// ---------- tuition manager + attendance
async function tuition(body, m) {
  const today = todayStr();
  const me = monthEnd(m);
  const [students, pays, att] = await Promise.all([
    api.select("students", "select=*&active=eq.true&order=name"),
    api.select("tuition_payments", `select=*&month=eq.${m}`),
    api.select("attendance", `select=*&date=gte.${m}&date=lte.${me}`),
  ]);
  const paidSet = Object.fromEntries(pays.map(p => [p.student_id, p]));
  const due = students.filter(s => !paidSet[s.id]).reduce((a, s) => a + +s.monthly_fee, 0);
  const got = pays.reduce((a, p) => a + +p.amount, 0);
  body.append(h("div.grid2", h("div.stat", h("div.k", "Received this month"), h("div.v.ok", tk(got))), h("div.stat", h("div.k", "Still due"), h("div.v.warn", tk(due)))));
  body.append(h("div.section-title", h("h2", "Students"), h("button.btn.small", { onclick: () => addStudent() }, icon("plus"), "Add student")));
  if (!students.length) { body.append(h("div.card.empty", icon("student"), h("p", "No students yet."), h("p.small", "Add students to track fees and attendance."))); return; }
  students.forEach(s => {
    const mine = att.filter(a => a.student_id === s.id);
    const present = mine.filter(a => a.present).length;
    const todayRec = mine.find(a => a.date === today);
    const p = paidSet[s.id];
    const payBtn = h("button.btn.small" + (p ? ".ghost" : ".primary"), p ? "✓ Paid" : "Mark paid");
    if (!p) payBtn.onclick = () => receivePayment(s, m);
    const attBtn = h("button.btn.small" + (todayRec?.present ? ".ghost" : ""), todayRec?.present ? "✓ Came today" : "Came today");
    attBtn.onclick = busy(attBtn, async () => {
      if (todayRec) await api.remove("attendance", `student_id=eq.${s.id}&date=eq.${today}`);
      else await api.insert("attendance", { user_id: api.userId(), student_id: s.id, date: today, present: true });
      rerender();
    });
    body.append(h("div.task", { style: { "--c": s.color, cursor: "pointer" }, onclick: e => { if (!e.target.closest("button")) location.hash = `#/student/${s.id}`; } }, h("div.grow",
      h("div.row.between", h("div.t", s.name, h("span.small.muted", "  · see graph ›")), h("span.dp", tk(s.monthly_fee) + "/mo")),
      h("div.meta", `Attendance this month: ${present} day${present === 1 ? "" : "s"}`, p ? h("span.ok", ` · paid ${tk(p.amount)}`) : h("span.warn", " · not paid yet")),
      h("div.acts", m === monthStart(today) ? attBtn : null, payBtn, h("button.btn.small.ghost", { onclick: () => addStudent(s) }, icon("edit"))))));
  });
}

function addStudent(s = null) {
  const name = h("input.input", { value: s?.name || "", placeholder: "e.g. Leon" });
  const fee = h("input.input", { type: "number", inputmode: "decimal", value: s?.monthly_fee || "", placeholder: "0" });
  let color = s?.color || PALETTE[Math.floor(Math.random() * 8)];
  const colors = colorPicker(color, c => color = c);
  return sheet(s ? "Edit student" : "Add student", [h("label.f", h("span", "Name"), name), h("label.f", h("span", "Monthly fee (৳)"), fee), h("label.f", h("span", "Colour (used in the week chart)"), colors)], {
    actions: close => {
      const save = h("button.btn.primary", t("Save"));
      save.onclick = busy(save, async () => {
        if (!name.value.trim()) throw new Error("Write the student's name.");
        const row = { name: name.value.trim(), monthly_fee: Number(fee.value) || 0, color };
        if (s) await api.update("students", `id=eq.${s.id}`, row); else await api.insert("students", { ...row, user_id: api.userId() });
        toast("Saved ✓", "ok"); close(true); rerender();
      });
      const b = [h("button.btn", { onclick: () => close(null) }, t("Cancel")), save];
      if (s) b.unshift(h("button.btn.danger", { onclick: async () => { if (await confirmBox("Remove student?", "Old payments stay in your money history.", "Remove", true)) { await api.update("students", `id=eq.${s.id}`, { active: false }); close(true); rerender(); } } }, icon("trash")));
      return b;
    },
  });
}

// ---------- dues + savings goals
async function plans(body) {
  const [dues, goals, all] = await Promise.all([
    api.select("dues", "select=*&order=settled,created_at.desc"),
    api.select("savings_goals", "select=*&order=created_at"),
    api.select("finance_entries", "select=kind,amount"),
  ]);
  const saved = all.reduce((s, r) => s + (r.kind === "income" ? +r.amount : -r.amount), 0);
  const theyOwe = dues.filter(d => !d.settled && d.direction === "they_owe").reduce((s, d) => s + +d.amount, 0);
  const iOwe = dues.filter(d => !d.settled && d.direction === "i_owe").reduce((s, d) => s + +d.amount, 0);

  body.append(h("div.section-title", h("h2", "Dues (বাকির খাতা)"), h("button.btn.small", { onclick: addDue }, icon("plus"), "Add")));
  body.append(h("div.grid2", h("div.stat", h("div.k", "Others owe me"), h("div.v.ok", tk(theyOwe))), h("div.stat", h("div.k", "I owe"), h("div.v.bad", tk(iOwe)))));
  if (dues.length) body.append(h("div.list.mt", dues.map(d => h("div.li", { style: { opacity: d.settled ? 0.5 : 1 } },
    h("div.grow", h("b", d.person), h("div.small.muted", d.direction === "they_owe" ? "owes me" : "I owe", d.note ? ` · ${d.note}` : "")),
    h("b" + (d.direction === "they_owe" ? ".ok" : ".bad"), tk(d.amount)),
    h("button.btn.small" + (d.settled ? ".ghost" : ""), { onclick: async () => { await api.update("dues", `id=eq.${d.id}`, { settled: !d.settled }); rerender(); } }, d.settled ? "Undo" : "Settled")))));

  body.append(h("div.section-title", h("h2", "Savings goals"), h("button.btn.small", { onclick: addGoal }, icon("plus"), "Add")));
  if (!goals.length) body.append(h("div.card.small.muted", "Example: “Microphone — ৳5,000 by December”. Progress uses your total savings."));
  goals.forEach(g => {
    const p = Math.max(0, Math.min(1, saved / g.target));
    body.append(h("div.card", h("div.row.between", h("b", g.title), h("span.small.muted", g.deadline ? "by " + fmtDate(g.deadline, { day: "numeric", month: "short", year: "numeric" }) : "")),
      h("div.bar.mt", h("i", { style: { width: p * 100 + "%" } })),
      h("div.row.between.small.mt", h("span.muted", `${tk(Math.max(0, saved))} of ${tk(g.target)}`), h("b", Math.round(p * 100) + "%")),
      h("button.linkbtn.small", { onclick: async () => { if (await confirmBox("Delete goal?", g.title, "Delete", true)) { await api.remove("savings_goals", `id=eq.${g.id}`); rerender(); } } }, "Delete")));
  });
}
function addDue() {
  const person = h("input.input", { placeholder: "e.g. Rafi" });
  const amt = h("input.input", { type: "number", inputmode: "decimal", min: "0" });
  const note = h("input.input", { placeholder: "optional" });
  let dir = "they_owe";
  const seg = h("div.seg", [["they_owe", "They owe me"], ["i_owe", "I owe them"]].map(([v, l]) => h("button" + (v === dir ? ".on" : ""), { type: "button", onclick: e => { dir = v; seg.querySelectorAll("button").forEach(b => b.classList.toggle("on", b === e.target)); } }, l)));
  sheet("Add due", [h("label.f", h("span", "Who?"), person), seg, h("div.mt", h("label.f", h("span", "Amount (৳)"), amt)), h("label.f", h("span", "Note"), note)], {
    actions: close => { const s = h("button.btn.primary", t("Save")); s.onclick = busy(s, async () => {
      if (!person.value.trim() || !(Number(amt.value) > 0)) throw new Error("Write a name and amount.");
      await api.insert("dues", { user_id: api.userId(), person: person.value.trim(), amount: Number(amt.value), direction: dir, note: note.value || null }); close(true); rerender(); });
      return [h("button.btn", { onclick: () => close(null) }, t("Cancel")), s]; },
  });
}
function addGoal() {
  const title = h("input.input", { placeholder: "e.g. New microphone" });
  const amt = h("input.input", { type: "number", inputmode: "decimal", min: "1" });
  const dl = h("input.input", { type: "date", min: todayStr() });
  sheet("Add savings goal", [h("label.f", h("span", "Goal"), title), h("div.grid2", h("label.f", h("span", "Target (৳)"), amt), h("label.f", h("span", "By (optional)"), dl))], {
    actions: close => { const s = h("button.btn.primary", t("Save")); s.onclick = busy(s, async () => {
      if (!title.value.trim() || !(Number(amt.value) > 0)) throw new Error("Write the goal and target.");
      await api.insert("savings_goals", { user_id: api.userId(), title: title.value.trim(), target: Number(amt.value), deadline: dl.value || null }); close(true); rerender(); });
      return [h("button.btn", { onclick: () => close(null) }, t("Cancel")), s]; },
  });
}

// ---------- receive tuition fee: choose which month(s) the money is for
export async function receivePayment(s, preMonth) {
  const today = todayStr();
  const cur = monthStart(today);
  const paid = new Set((await api.select("tuition_payments", `select=month&student_id=eq.${s.id}`)).map(x => x.month.slice(0, 7)));
  const months = [...Array(8)].map((_, i) => shiftMonth(cur, i - 6)).filter(x => !paid.has(x.slice(0, 7)) && x >= [monthStart((s.created_at || today).slice(0, 10)), shiftMonth(cur, -3)].sort()[0]); // last 3 months (or since joined) … next month
  if (!months.length) { toast("All recent months are already paid."); return; }
  const pick = new Set([preMonth && months.includes(preMonth) ? preMonth : (months.filter(x => x < cur).pop() || months[0])]);
  const amounts = {};
  const box = h("div");
  const total = h("b");
  const draw = () => {
    box.replaceChildren(...months.map(mo => {
      const on = pick.has(mo);
      const inp = h("input.input", { type: "number", inputmode: "decimal", min: "0", value: amounts[mo] ?? s.monthly_fee, style: { width: "120px", minHeight: "38px" }, oninput: e => { amounts[mo] = e.target.value; sum(); } });
      return h("div.row.between", { style: { padding: "6px 0", borderBottom: "1px solid var(--line)" } },
        h("label.check", { style: { margin: 0, alignItems: "center" } },
          h("input", { type: "checkbox", checked: on, onchange: e => { e.target.checked ? pick.add(mo) : pick.delete(mo); draw(); } }),
          h("span", monthLabel(mo), mo < cur ? h("span.small.warn", " · due") : mo === cur ? h("span.small.muted", " · this month") : h("span.small.muted", " · advance"))),
        on ? inp : h("span.small.faint", "—"));
    }));
    sum();
  };
  const sum = () => { total.textContent = tk([...pick].reduce((a, mo) => a + (Number(amounts[mo] ?? s.monthly_fee) || 0), 0)); };
  draw();
  const ok = await sheet(`Receive fee · ${s.name}`, [
    h("p.hint", "Tick the month(s) this money is for. Paying for two months together? Tick both. It's added to today's income."),
    box, h("div.row.between.mt", h("span.muted", "Total received today"), total)], {
    actions: close => [h("button.btn", { onclick: () => close(null) }, t("Cancel")), h("button.btn.primary", { onclick: () => close(true) }, "Save")] });
  if (!ok) return;
  if (!pick.size) { toast("Tick at least one month.", "bad"); return; }
  try {
    for (const mo of [...pick].sort()) await api.rpc("record_tuition_payment", { p_student: s.id, p_month: mo, p_amount: Number(amounts[mo] ?? s.monthly_fee) || 0 });
    toast(`Saved for ${[...pick].sort().map(x => monthLabel(x).split(" ")[0]).join(" + ")} ✓ added to income`, "ok"); rerender();
  } catch (e) { toast(e.message, "bad"); }
}

// ---------- one student: money and attendance month by month
route("student", async (page, id) => {
  const [rows, pays, att] = await Promise.all([
    api.select("students", `select=*&id=eq.${id}`),
    api.select("tuition_payments", `select=*&student_id=eq.${id}&order=month`),
    api.select("attendance", `select=date,present&student_id=eq.${id}&order=date`),
  ]);
  const s = rows[0];
  if (!s) throw new Error("Student not found.");
  page.append(backbar(s.name, "#/money/tuition", h("div.row", h("button.btn.small.primary", { onclick: () => receivePayment(s) }, icon("money"), "Receive fee"), h("button.icon-btn", { "aria-label": "Edit student", onclick: () => addStudent(s) }, icon("edit")))));
  // last 12 months
  const today = todayStr();
  const months = [...Array(12)].map((_, i) => shiftMonth(monthStart(today), i - 11));
  const paid = Object.fromEntries(pays.map(p => [p.month.slice(0, 7), +p.amount]));
  const days = {}; att.filter(a => a.present).forEach(a => days[a.date.slice(0, 7)] = (days[a.date.slice(0, 7)] || 0) + 1);
  const firstM = [pays[0]?.month, att[0]?.date, s.created_at?.slice(0, 10)].filter(Boolean).sort()[0]?.slice(0, 7) || today.slice(0, 7);
  const shown = months.filter(m => m.slice(0, 7) >= firstM);
  const lbl = m => new Date(m + "T00:00:00").toLocaleDateString("en-GB", { month: "short" });
  const total = pays.reduce((a, p) => a + +p.amount, 0);
  const unpaid = shown.filter(m => !paid[m.slice(0, 7)] && m.slice(0, 7) < today.slice(0, 7)).length;
  const thisM = today.slice(0, 7);
  const last = shown.length > 1 ? paid[shown[shown.length - 2].slice(0, 7)] || 0 : 0;
  const cur = paid[thisM] || 0;

  page.append(h("div.grid3",
    h("div.stat", h("div.k", "Total received"), h("div.v.ok", tk(total))),
    h("div.stat", h("div.k", "Monthly fee"), h("div.v", tk(s.monthly_fee))),
    h("div.stat", h("div.k", "Days taught (this month)"), h("div.v", days[thisM] || 0))));
  page.append(h("p.small.muted", { style: { margin: "8px 2px 10px" } },
    unpaid ? h("span.warn", `${unpaid} past month${unpaid > 1 ? "s" : ""} not paid. `) : "All past months paid. ",
    cur && last ? (cur > last ? `Up ${tk(cur - last)} from last month.` : cur < last ? `Down ${tk(last - cur)} from last month.` : "Same as last month.") : ""));
  page.append(h("div.card", h("h3", "Money received by month"),
    barChart(shown.map(m => ({ l: lbl(m), v: paid[m.slice(0, 7)] || 0, c: s.color })), { fmt: tk }),
    h("p.hint.mb0", "Empty bar = not paid that month.")));
  page.append(h("div.card", h("h3", "Days taught by month"),
    barChart(shown.map(m => ({ l: lbl(m), v: days[m.slice(0, 7)] || 0 })), { color: "var(--cyan)" }),
    h("p.hint.mb0", "Counted automatically when a tuition task with this student is marked Completed, or when you tap “Came today”.")));
  page.append(h("div.section-title", h("h2", "Month by month")));
  page.append(h("div.list", shown.slice().reverse().map(m => {
    const k = m.slice(0, 7), p = pays.find(x => x.month.slice(0, 7) === k);
    return h("div.li", h("div.grow", h("b", new Date(m + "T00:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" })),
      h("div.small.muted", `${days[k] || 0} day${days[k] === 1 ? "" : "s"} taught`, p ? ` · paid on ${fmtDate(p.paid_on)}` : "")),
      p ? h("b.ok", tk(p.amount)) : h("span.badge" + (k < thisM ? ".bad" : ".warn"), k < thisM ? "Not paid" : "Due"));
  })));
}, { tab: "money" });
