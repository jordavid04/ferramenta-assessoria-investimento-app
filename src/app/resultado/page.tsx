"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { RecommendationResult } from "@/lib/ai/prompt";

interface Payload {
  id: string | null;
  score: number;
  profile: "Conservador" | "Moderado" | "Arrojado" | "Agressivo";
  source: "gemini" | "fallback";
  recommendation: RecommendationResult;
}

const COLORS = ["#2563eb", "#059669", "#d97706", "#7c3aed", "#64748b"];

export default function ResultadoPage() {
  const [data, setData] = useState<Payload | null | undefined>(undefined);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("investpro:resultado");
      setData(raw ? (JSON.parse(raw) as Payload) : null);
    } catch {
      setData(null);
    }
  }, []);

  if (data === undefined) return <p className="text-slate-500">Carregando…</p>;
  if (data === null)
    return (
      <div className="rounded-2xl bg-white p-8 shadow-sm">
        <p>Nenhum resultado encontrado. <Link className="text-brand underline" href="/suitability">Responda o questionário</Link>.</p>
      </div>
    );

  const { recommendation: r } = data;
  const alloc = r.allocation.filter((a) => a.percent > 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Seu perfil de investidor</h1>
          <p className="text-slate-600">Pontuação: {data.score} de 72</p>
        </div>
        <span className="rounded-full bg-emerald-100 px-4 py-1.5 font-bold text-emerald-800">Perfil {data.profile}</span>
      </header>

      <section className="rounded-xl border border-dashed border-ia bg-ia-bg p-5">
        <p className="mb-2 flex items-center gap-2 font-bold">
          <span className="rounded-full bg-ia px-2 py-0.5 text-xs text-white">IA</span> Explicação do perfil
        </p>
        <p>{r.profileExplanation}</p>
        <p className="mt-2 text-xs text-slate-500">
          {data.source === "gemini" ? "Gerado pelo Google Gemini." : "Gerado pelo motor local (modo offline)."} O perfil foi calculado pelas regras do questionário.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Distribuição sugerida</h2>
          <div className="mt-4 flex h-5 overflow-hidden rounded-full" role="img" aria-label="Distribuição da carteira">
            {alloc.map((a, i) => <div key={a.assetClass} style={{ width: `${a.percent}%`, background: COLORS[i % COLORS.length] }} />)}
          </div>
          <ul className="mt-4 space-y-3">
            {alloc.map((a, i) => (
              <li key={a.assetClass} className="text-sm">
                <p className="flex items-center gap-2 font-semibold">
                  <span className="h-3 w-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  {a.assetClass} — {a.percent}%
                </p>
                <p className="pl-5 text-slate-600">{a.rationale}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sugestões por classe de ativo</h2>
          {r.suggestions.map((s) => (
            <div key={s.title} className="rounded-xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold uppercase text-slate-500">{s.assetClass}</span>
                <span className="font-semibold text-emerald-700">Compatibilidade: {s.compatibility}%</span>
              </div>
              <p className="mt-1 font-bold">{s.title}</p>
              <p className="text-sm text-slate-600">{s.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="font-bold">Dicas de educação financeira</h2>
        <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-slate-700">
          {r.educationalTips.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </section>

      <p className="rounded-lg bg-amber-50 p-4 text-xs text-amber-900">{r.disclaimer}</p>
      <Link href="/suitability" className="inline-block rounded-lg border border-slate-300 bg-white px-5 py-2.5 font-semibold">Refazer questionário</Link>
    </div>
  );
}
