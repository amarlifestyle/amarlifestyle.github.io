// Amar Lifestyle — AI Coach: daily advice, alerts, ask a question, build a routine by voice
import * as api from "./api.js";
import { h, icon, toast, sheet, busy, todayStr, addDays, DAYS, PALETTE, dhakaIso, durLabel, fmtHM } from "./ui.js";
import { store, catNames, rerender } from "./app.js";
import { micButton } from "./voice.js";

// card on the Today page (loads after the page so nothing waits for it)
export function coachCard() {
  const box = h("div.card", { style: { borderColor: "color-mix(in srgb, var(--brand) 40%, transparent)", background: "linear-gradient(160deg, color-mix(in srgb, var(--brand) 9%, var(--card)), var(--card))" } });
  const head = (extra) => h("div.row.between", h("b", "🤖 AI Coach"), extra);
  const load = async refresh => {
    box.replaceChildren(head(), h("p.small.muted.mb0", refresh ? "Thinking…" : "Loading advice…"));
    try {
      const r = await api.ai("coach", { refresh });
      api.LS.set("al_coach", r);
      draw(r);
    } catch (e) {
      const c = api.LS.get("al_coach");
      if (c) { draw(c); box.append(h("p.small.faint.mb0", e.offline ? "Offline — showing last advice." : e.message)); }
      else box.replaceChildren(head(), h("p.small.muted.mb0", e.message));
    }
  };
  const draw = r => {
    const re = h("button.btn.small.ghost", { "aria-label": "New advice" }, icon("routine"));
    re.onclick = busy(re, () => load(true));
    box.replaceChildren(...[head(h("div.row", { style: { gap: "6px" } }, h("button.btn.small", { onclick: askSheet }, "Ask AI"), re)),
      r.summary ? h("p", { style: { margin: "6px 0 8px" } }, r.summary) : null,
      (r.alerts || []).map(a => h("div", { style: { padding: "8px 10px", borderRadius: "10px", margin: "6px 0", background: `color-mix(in srgb, ${a.level === "high" ? "var(--red)" : "var(--amber)"} 13%, transparent)`, border: `1px solid color-mix(in srgb, ${a.level === "high" ? "var(--red)" : "var(--amber)"} 45%, transparent)` } },
        h("b", { style: { color: a.level === "high" ? "var(--red)" : "var(--amber)" } }, "⚠️ ", a.title), h("div.small", a.text))),
      (r.tips || []).map(t => h("div", { style: { padding: "6px 0", borderTop: "1px solid var(--line)" } }, h("b.small", "💡 ", t.title), h("div.small.muted", t.text)))].flat().filter(Boolean));
  };
  load(false);
  return box;
}

export function askSheet() {
  const q = h("textarea.input", { placeholder: "e.g. এই মাসে কোথায় টাকা বাঁচাতে পারি? / আমার পড়ার সবচেয়ে ভালো সময় কোনটা?", maxlength: "600" });
  const out = h("div");
  return sheet("Ask AI", [h("div.row.between", h("span.small.muted", "Ask about your routine, DP or money"), micButton(t => q.value = t)), q, out], {
    actions: close => {
      const go = h("button.btn.primary", "Ask");
      go.onclick = busy(go, async () => {
        out.replaceChildren(h("p.small.muted", "Thinking…"));
        const r = await api.ai("ask", { question: q.value });
        out.replaceChildren(h("div.card", { style: { marginTop: "10px", whiteSpace: "pre-wrap" } }, r.answer));
      });
      return [h("button.btn", { onclick: () => close() }, "Close"), go];
    },
  });
}

// build a routine from one long voice/text description
const DAYMAP = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
export function aiPlanSheet(ctx) {
  const text = h("textarea.input", { placeholder: "Say or type your whole week. e.g. শনি, বুধ আর বৃহস্পতি বিকাল ৫টা C.P পড়াই ১ ঘণ্টা, তারপর ৬টায় C.B। প্রতিদিন রাত ১০টা থেকে ১২টা পড়ি।", style: { minHeight: "110px" } });
  const result = h("div");
  let items = [];
  const draw = () => {
    result.replaceChildren(items.length ? h("div.list.mt", items.map((it, i) => {
      const days = (it.days || []).map(d => d.slice(0, 3));
      const rep = h("select.input", { style: { minHeight: "34px", width: "auto", padding: "4px 8px", fontSize: "13px" }, onchange: e => it.repeat = e.target.value },
        h("option", { value: "perm", selected: it.repeat !== "week" }, "Every week"), h("option", { value: "week", selected: it.repeat === "week" }, "This week"));
      return h("div.li", { style: { alignItems: "flex-start" } },
        h("input", { type: "checkbox", checked: it.on !== false, style: { width: "22px", height: "22px", accentColor: "var(--brand)", marginTop: "3px" }, onchange: e => it.on = e.target.checked, "aria-label": "Include" }),
        h("div.grow", h("b", it.title), it.student ? h("span.small.muted", " · " + it.student) : null,
          h("div.small.muted", `${days.join(", ")} · ${fmtHM(it.start)} · ${durLabel(it.minutes || 60)} · ${it.category}`),
          it.guessed ? h("div.small.warn", "🤔 Guess: ", it.note || "from your usual routine") : null),
        rep);
    })) : null);
  };
  return sheet("🤖 Build routine with AI", [
    h("p.hint", "Tell your whole routine in your own words. AI understands Bangla, English or mixed, and fills gaps from your usual routine. You check before saving."),
    h("div.row.between", h("span.small.muted", "Speak or type"), micButton(t => text.value = (text.value ? text.value + " " : "") + t)),
    text, result,
  ], {
    actions: close => {
      const make = h("button.btn", "🤖 Make plan");
      const save = h("button.btn.primary", { disabled: true }, "Save selected");
      make.onclick = busy(make, async () => {
        result.replaceChildren(h("p.small.muted.mt", "AI is reading your routine…"));
        const r = await api.ai("plan", { text: text.value });
        items = (r.items || []).filter(x => x.title && x.start && (x.days || []).length);
        draw();
        if (r.question) result.prepend(h("div.card.small.warn.mt", "❓ ", r.question));
        if (!items.length) result.append(h("p.small.bad", "Couldn't find tasks. Mention day, time and what you do."));
        save.disabled = !items.length; make.textContent = "🤖 Try again";
      });
      save.onclick = busy(save, async () => {
        const chosen = items.filter(x => x.on !== false);
        if (!chosen.length) throw new Error("Tick at least one.");
        const students = ctx.students || [];
        const active = (ctx.routines || []).find(r => r.active)?.template || "Normal";
        const cats = catNames();
        let n = 0;
        for (const [i, it] of chosen.entries()) {
          const st = students.find(s => s.name.toLowerCase() === String(it.student || "").toLowerCase());
          const cat = cats.includes(it.category) ? it.category : (st ? "Tuition" : "Work / Personal");
          const days = (it.days || []).map(d => DAYMAP[d.slice(0, 3)]).filter(d => d !== undefined);
          const minutes = Math.min(720, Math.max(5, Number(it.minutes) || 60));
          const color = st?.color || PALETTE[(i * 5) % PALETTE.length];
          if (it.repeat === "week") {
            for (const d of days) {
              const date = [...Array(7)].map((_, k) => addDays(ctx.ws, k)).find(x => new Date(x + "T00:00:00").getDay() === d);
              const s = dhakaIso(date, it.start);
              if (new Date(s) < new Date()) continue;
              const id = await api.rpc("add_task", { p_title: it.title, p_category: cat, p_start: s, p_end: new Date(new Date(s).getTime() + minutes * 60000).toISOString(), p_student: st?.id || null });
              await api.update("tasks", `id=eq.${id}`, { color });
              n++;
            }
          } else {
            await api.insert("routines", { user_id: api.userId(), title: it.title, category: cat, start_time: it.start, duration_min: minutes, days, color, template: active, student_id: cat === "Tuition" ? st?.id || null : null, active: true });
            n++;
          }
        }
        await api.rpc("ensure_tasks", { p_from: todayStr(), p_to: addDays(todayStr(), 7) });
        toast(`Saved ${n} item${n === 1 ? "" : "s"} to your week ✓`, "ok"); close(); rerender();
      });
      return [h("button.btn", { onclick: () => close() }, "Cancel"), make, save];
    },
  });
}
