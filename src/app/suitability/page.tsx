"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { GROUPS, QUESTIONS, type OptionKey, type Question } from "@/lib/suitability/questions";

const ORDER = ["situacao", "objetivos", "conhecimento", "tolerancia"] as const;
const STEPS = ORDER.map((g) => ({ key: g, ...GROUPS[g], questions: QUESTIONS.filter((q) => q.group === g) }));

export default function SuitabilityPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, OptionKey>>({});
  const [accepted, setAccepted] = useState({ terms: false, risk: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const answered = Object.keys(answers).length;
  const stepDone = useMemo(() => current.questions.every((q) => answers[q.id]), [current, answers]);
  const canSubmit = stepDone && accepted.terms && accepted.risk;

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/suitability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, acceptedTerms: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível gerar o resultado.");
      try { sessionStorage.setItem("investpro:resultado", JSON.stringify(data)); } catch { /* modo privado */ }
      router.push("/resultado");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="rounded-2xl bg-white p-5 shadow-sm lg:sticky lg:top-6 lg:self-start">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Formulário de Suitability</p>
        <ol className="mt-3 space-y-2">
          {STEPS.map((s, i) => (
            <li key={s.key} className={`rounded-lg px-3 py-2 text-sm ${i === step ? "bg-brand font-semibold text-white" : i < step ? "bg-blue-50 text-brand" : "text-slate-500"}`}>
              {i + 1}. {s.title}
            </li>
          ))}
        </ol>
        <div className="mt-4" aria-label="Progresso">
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-brand transition-all" style={{ width: `${(answered / QUESTIONS.length) * 100}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-500">{answered} de {QUESTIONS.length} respondidas</p>
        </div>
      </aside>

      <section className="space-y-5">
        <header>
          <h1 className="text-2xl font-extrabold">{current.title}</h1>
          <p className="text-slate-600">{current.hint}</p>
        </header>

        {current.questions.map((q) => <QuestionCard key={q.id} q={q} value={answers[q.id]} onChange={(k) => setAnswers((a) => ({ ...a, [q.id]: k }))} />)}

        {isLast && (
          <div className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Aceite dos termos</p>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={accepted.terms} onChange={(e) => setAccepted((a) => ({ ...a, terms: e.target.checked }))} />
              <span>Li e aceito que o resultado é <b>conteúdo educacional</b> e não constitui recomendação individualizada de investimento.</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={accepted.risk} onChange={(e) => setAccepted((a) => ({ ...a, risk: e.target.checked }))} />
              <span>Estou ciente de que investimentos envolvem riscos e posso ter perdas.</span>
            </label>
          </div>
        )}

        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="flex gap-3">
          <button disabled={step === 0 || loading} onClick={() => setStep((s) => s - 1)} className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 font-semibold disabled:opacity-40">
            Voltar
          </button>
          {isLast ? (
            <button disabled={!canSubmit || loading} onClick={submit} className="rounded-lg bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand-dark disabled:opacity-40">
              {loading ? "Gerando seu resultado…" : "Ver meu perfil"}
            </button>
          ) : (
            <button disabled={!stepDone} onClick={() => { setStep((s) => s + 1); window.scrollTo({ top: 0 }); }} className="rounded-lg bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand-dark disabled:opacity-40">
              Próxima etapa
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function QuestionCard({ q, value, onChange }: { q: Question; value?: OptionKey; onChange: (k: OptionKey) => void }) {
  return (
    <fieldset className="rounded-2xl bg-white p-5 shadow-sm">
      <legend className="px-1 text-base font-bold">{q.id}. {q.text}</legend>
      <div className="mt-3 space-y-2">
        {(Object.entries(q.options) as [OptionKey, string][]).map(([k, label]) => (
          <label key={k} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm ${value === k ? "border-brand bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}>
            <input type="radio" name={`q${q.id}`} value={k} checked={value === k} onChange={() => onChange(k)} />
            <span><b className="mr-1">{k})</b>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
