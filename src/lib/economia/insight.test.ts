import { test } from "node:test";
import assert from "node:assert/strict";
import { AI_FAILURE_BACKOFF_MS, buildEconomicPrompt, createInsightService, INSIGHT_TTL_MS, localInsight, parseInsight } from "./insight.ts";
import { createMemoryStore } from "./store.ts";
import type { ScenarioFacts } from "./scenario.ts";

const NOW = new Date("2026-11-04T12:00:00Z");
const facts: ScenarioFacts = { selic: 13.75, cdi: 13.65, ipca12m: 4.58, realRate: 8.82, selicTrend: "estavel", ipcaTrend: "alta", dolarTrend: "queda" };

const goodAi = {
  reading: "Com a Selic em 13,75% ao ano e a inflação em 4,58%, o juro real fica em 8,82% ao ano. Para o perfil Conservador, isso favorece a renda fixa.",
  classNotes: [
    { assetClass: "Renda Fixa", note: "Juros altos tornam a renda fixa mais atrativa." },
    { assetClass: "Fundos Imobiliários", note: "Juros altos podem pesar sobre os preços dos fundos imobiliários." },
    { assetClass: "Fundos", note: "Fundos DI acompanham a Selic." },
  ],
};

function svc(generate: (p: string) => Promise<unknown>, extra: { hasKey?: () => boolean; now?: () => Date; store?: ReturnType<typeof createMemoryStore> } = {}) {
  const calls = { n: 0, prompts: [] as string[] };
  const service = createInsightService({
    generate: async (p) => {
      calls.n++;
      calls.prompts.push(p);
      return generate(p);
    },
    store: extra.store ?? createMemoryStore(),
    now: extra.now ?? (() => NOW),
    hasKey: extra.hasKey ?? (() => true),
  });
  return { service, calls };
}

test("resposta válida da IA é usada e identificada como gemini", async () => {
  const { service } = svc(async () => goodAi);
  const out = await service.get("Conservador", facts);
  assert.equal(out.source, "gemini");
  assert.equal(out.insight.reading, goodAi.reading);
});

test("sem chave da IA: texto local (modo offline), sem chamar a IA", async () => {
  const { service, calls } = svc(async () => goodAi, { hasKey: () => false });
  const out = await service.get("Moderado", facts);
  assert.equal(out.source, "fallback");
  assert.match(out.fallbackReason!, /GEMINI_API_KEY/);
  assert.equal(calls.n, 0);
  assert.match(out.insight.reading, /Moderado/);
});

test("IA com erro (rede/HTTP/JSON inválido) cai no texto local", async () => {
  for (const bad of [
    async () => {
      throw new Error("Gemini respondeu HTTP 503");
    },
    async () => ({ foo: 1 }),
    async () => ({ reading: "", classNotes: [] }),
    async () => ({ reading: "ok", classNotes: [{ assetClass: "Criptomoedas", note: "x" }] }),
  ]) {
    const { service } = svc(bad);
    const out = await service.get("Conservador", facts);
    assert.equal(out.source, "fallback");
    assert.ok(out.insight.reading.length > 0);
  }
});

test("texto da IA reprovado na verificação é descartado (ticker, promessa, recomendação, número inventado)", async () => {
  const variants = [
    { ...goodAi, reading: "Considere PETR4 neste cenário." },
    { ...goodAi, reading: "A renda fixa é garantida e rende 14% ao ano." },
    { ...goodAi, reading: "Compre títulos públicos agora." },
    { ...goodAi, reading: "A Selic deve cair para 9,5% em breve." },
    { ...goodAi, reading: "Para o perfil Agressivo, o cenário pesa." },
    { ...goodAi, classNotes: [{ assetClass: "Ações", note: "Invista em ações já." }] },
  ];
  for (const v of variants) {
    const { service } = svc(async () => v);
    const out = await service.get("Conservador", facts);
    assert.equal(out.source, "fallback", JSON.stringify(v).slice(0, 60));
    assert.match(out.fallbackReason!, /reprovado/);
    assert.ok(!/PETR4|garantid|Compre/.test(out.insight.reading + JSON.stringify(out.insight.classNotes)));
  }
});

test("mesmo perfil e cenário reaproveitam a leitura; perfil diferente gera outra", async () => {
  const store = createMemoryStore();
  const { service, calls } = svc(async () => goodAi, { store });
  await service.get("Conservador", facts);
  const again = await service.get("Conservador", facts);
  assert.equal(again.source, "gemini");
  assert.equal(calls.n, 1);
  await service.get(null, facts).catch(() => {});
  assert.equal(calls.n, 2, "leitura geral é outra chave de cache");
});

test("leitura em cache expira depois de 24h e é gerada de novo", async () => {
  let t = NOW;
  const store = createMemoryStore(() => t);
  const { service, calls } = svc(async () => goodAi, { store, now: () => t });
  await service.get("Conservador", facts);
  t = new Date(NOW.getTime() + INSIGHT_TTL_MS - 1000);
  await service.get("Conservador", facts);
  assert.equal(calls.n, 1, "ainda dentro das 24h");
  t = new Date(NOW.getTime() + INSIGHT_TTL_MS + 1000);
  await service.get("Conservador", facts);
  assert.equal(calls.n, 2, "passou das 24h");
});

test("depois de falha da IA, não insiste por alguns minutos", async () => {
  let t = NOW;
  const { service, calls } = svc(
    async () => {
      throw new Error("timeout");
    },
    { now: () => t },
  );
  await service.get("Conservador", facts);
  await service.get("Conservador", facts);
  assert.equal(calls.n, 1);
  t = new Date(NOW.getTime() + AI_FAILURE_BACKOFF_MS + 1);
  await service.get("Conservador", facts);
  assert.equal(calls.n, 2);
});

test("prompt só leva números do sistema, o perfil e a alocação-base; sem perfil pede leitura geral", () => {
  const p = buildEconomicPrompt("Conservador", facts);
  assert.match(p, /Taxa Selic: 13,75% ao ano/);
  assert.match(p, /Juro real.*8,82%/);
  assert.match(p, /PERFIL DO INVESTIDOR.*Conservador/);
  assert.match(p, /"assetClass":"Renda Fixa","percent":80/);
  assert.match(p, /NUNCA cite tickers/);
  assert.match(p, /nunca prometa rentabilidade/);
  assert.match(p, /português do Brasil/);
  assert.doesNotMatch(p, /Fale das classes:[^\n]*Ações/, "Conservador tem 0% em Ações: não entra na lista de classes");

  const g = buildEconomicPrompt(null, facts);
  assert.match(g, /explicação GERAL/);
  assert.doesNotMatch(g, /PERFIL DO INVESTIDOR/);
});

test("parseInsight valida o contrato", () => {
  assert.deepEqual(parseInsight({ reading: " oi ", classNotes: [{ assetClass: "Ações", note: " x " }] }), {
    reading: "oi",
    classNotes: [{ assetClass: "Ações", note: "x" }],
  });
  assert.throws(() => parseInsight(null));
  assert.throws(() => parseInsight({ reading: "x", classNotes: "y" }));
});

test("o texto local muda com o perfil e com o cenário", () => {
  const cons = localInsight("Conservador", facts).reading;
  const agr = localInsight("Agressivo", facts).reading;
  assert.notEqual(cons, agr);
  assert.match(cons, /Conservador/);
  const baixo = localInsight("Conservador", { ...facts, selic: 7, realRate: 2 }).reading;
  assert.notEqual(cons, baixo);
  assert.deepEqual(localInsight("Conservador", facts).classNotes.map((n) => n.assetClass), ["Renda Fixa", "Fundos", "Fundos Imobiliários"]);
  assert.equal(localInsight(null, facts).classNotes.length, 5);
});
