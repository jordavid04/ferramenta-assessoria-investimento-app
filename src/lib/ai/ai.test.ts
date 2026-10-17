import { test } from "node:test";
import assert from "node:assert/strict";
import { allocationSum, BASE_ALLOCATION } from "./allocation.ts";
import { fallbackRecommendation } from "./fallback.ts";
import { buildPrompt } from "./prompt.ts";
import { validateAllocation, getRecommendation } from "./gemini.ts";
import { QUESTIONS } from "../suitability/questions.ts";
import type { Answers, Profile } from "../suitability/scoring.ts";

const profiles: Profile[] = ["Conservador", "Moderado", "Arrojado", "Agressivo"];
const answers: Answers = Object.fromEntries(QUESTIONS.map((q) => [q.id, "B"]));

test("toda alocação-base soma 100%", () => {
  for (const p of profiles) assert.equal(allocationSum(BASE_ALLOCATION[p]), 100, p);
});

test("risco cresce com o perfil: renda fixa diminui e ações aumentam", () => {
  const rf = profiles.map((p) => BASE_ALLOCATION[p].find((a) => a.assetClass === "Renda Fixa")!.percent);
  const ac = profiles.map((p) => BASE_ALLOCATION[p].find((a) => a.assetClass === "Ações")!.percent);
  assert.deepEqual([...rf].sort((a, b) => b - a), rf);
  assert.deepEqual([...ac].sort((a, b) => a - b), ac);
});

test("fallback é válido para todos os perfis e sempre traz aviso legal", () => {
  for (const p of profiles) {
    const r = fallbackRecommendation(p);
    assert.equal(validateAllocation(r, p), true, p);
    assert.match(r.disclaimer, /Não constitui recomendação/);
    assert.ok(r.suggestions.every((s) => s.compatibility >= 0 && s.compatibility <= 100));
  }
});

test("validação rejeita alocação que não soma 100 ou foge da base", () => {
  const r = fallbackRecommendation("Moderado");
  assert.equal(validateAllocation({ ...r, allocation: r.allocation.map((a, i) => (i === 0 ? { ...a, percent: a.percent + 5 } : a)) }, "Moderado"), false);
  const shifted = r.allocation.map((a, i) => (i === 0 ? { ...a, percent: a.percent + 20 } : i === 1 ? { ...a, percent: a.percent - 20 } : a));
  assert.equal(validateAllocation({ ...r, allocation: shifted }, "Moderado"), false);
});

test("prompt contém o perfil calculado e todas as 18 respostas", () => {
  const p = buildPrompt(answers, 36, "Moderado");
  assert.match(p, /PERFIL CALCULADO: Moderado \(36 de 72 pontos\)/);
  for (let i = 1; i <= 18; i++) assert.match(p, new RegExp(`^${i}\\. `, "m"));
});

test("sem GEMINI_API_KEY o sistema usa o modo offline", async () => {
  const saved = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const out = await getRecommendation(answers, 36, "Moderado");
  assert.equal(out.source, "fallback");
  if (saved) process.env.GEMINI_API_KEY = saved;
});

test("resposta inválida do Gemini aciona fallback (fetch simulado)", async () => {
  const realFetch = globalThis.fetch;
  process.env.GEMINI_API_KEY = "teste";
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "{\"foo\":1}" }] } }] }), { status: 200 })) as typeof fetch;
  try {
    const out = await getRecommendation(answers, 36, "Moderado");
    assert.equal(out.source, "fallback");
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.GEMINI_API_KEY;
  }
});

test("resposta válida do Gemini (fetch simulado) é aceita", async () => {
  const realFetch = globalThis.fetch;
  process.env.GEMINI_API_KEY = "teste";
  const good = { ...fallbackRecommendation("Moderado"), disclaimer: "x" };
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(good) }] } }] }), { status: 200 })) as typeof fetch;
  try {
    const out = await getRecommendation(answers, 36, "Moderado");
    assert.equal(out.source, "gemini");
    assert.match(out.result.disclaimer, /Não constitui recomendação/); // aviso legal é sempre o do sistema
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.GEMINI_API_KEY;
  }
});
