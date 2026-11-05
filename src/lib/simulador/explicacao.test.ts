import { test } from "node:test";
import assert from "node:assert/strict";
import type { Profile } from "../suitability/scoring.ts";
import { fmtBRL, fmtPercent } from "../economia/format.ts";
import { baseAllocation, PROFILES } from "./perfil.ts";
import { checkSimText, type GuardInput } from "./guarda.ts";
import { buildReadingPrompt, createReadingCache, createReadingService, fmtMonths, fmtYears, localReading, parseReading, readingCacheKey } from "./explicacao.ts";
import { project } from "./projecao.ts";
import type { SimInput } from "./validacao.ts";

const RATES = { cdi: 14.5, ipca12m: 4.5 };

function guard(profile: Profile, input: SimInput = { initial: 10_000, monthly: 500, years: 10, goal: null }, rates = RATES): GuardInput {
  const allocation = baseAllocation(profile);
  return { profile, allocation, projection: project(input, allocation, rates) };
}

const memoryCache = () => createReadingCache(() => new Date(), {
  getEconomicInsightRow: async () => null,
  saveEconomicInsightRow: async () => {},
});

/* ----------------------------- Texto local ----------------------------- */

test("o texto local passa na própria verificação, para todos os perfis e situações", () => {
  const inputs: SimInput[] = [
    { initial: 10_000, monthly: 500, years: 10, goal: null },
    { initial: 0, monthly: 300, years: 0.5, goal: 5_000 },
    { initial: 50_000, monthly: 0, years: 3, goal: 40_000 },
    { initial: 1_234_567.89, monthly: 98_765.43, years: 30, goal: 99_999_999 },
    { initial: 1000, monthly: 100, years: 1, goal: 1_000_000 },
    { initial: 2000, monthly: 0, years: 7.5, goal: 3000 },
  ];
  const rateSets = [RATES, { cdi: 4, ipca12m: 3 }, { cdi: 0.5, ipca12m: 8 }];
  for (const profile of PROFILES) {
    for (const input of inputs) {
      for (const rates of rateSets) {
        const g = guard(profile, input, rates);
        const text = localReading(g);
        assert.deepEqual(checkSimText(text, g), [], `${profile} ${JSON.stringify(input)} ${JSON.stringify(rates)}: ${text}`);
      }
    }
  }
});

test("o texto local muda conforme o perfil e cita os números calculados", () => {
  const a = guard("Conservador");
  const b = guard("Agressivo");
  assert.notEqual(localReading(a), localReading(b));
  const text = localReading(b);
  assert.ok(text.includes(fmtBRL(b.projection.scenarios.base.finalValue)));
  assert.ok(text.includes(fmtBRL(b.projection.scenarios.base.realValue)));
  assert.match(localReading(a), /estreita/);
  assert.match(text, /larga/);
});

test("o texto local fala de perda quando o pessimista termina abaixo do investido", () => {
  const g = guard("Agressivo", { initial: 10_000, monthly: 0, years: 5, goal: null }, { cdi: 4, ipca12m: 3 });
  assert.equal(g.projection.scenarios.pessimista.belowInvested, true);
  assert.match(localReading(g), /perdas são possíveis/);
});

test("o texto local avisa que juro alto não torna o risco mais rentável", () => {
  assert.match(localReading(guard("Agressivo")), /não significa, por si só, retorno maior/);
  assert.doesNotMatch(localReading(guard("Agressivo", undefined, { cdi: 4, ipca12m: 3 })), /não significa, por si só/);
});

test("o texto local menciona a meta", () => {
  const reached = guard("Moderado", { initial: 0, monthly: 2000, years: 10, goal: 50_000 });
  assert.match(localReading(reached), /alcançaria em/);
  const missing = guard("Moderado", { initial: 1000, monthly: 100, years: 1, goal: 1_000_000 });
  assert.match(localReading(missing), /abaixo ao final do prazo/);
});

test("formatação de prazo", () => {
  assert.equal(fmtYears(1), "1 ano");
  assert.equal(fmtYears(10), "10 anos");
  assert.equal(fmtYears(7.5), "7,5 anos");
  assert.equal(fmtMonths(5), "5 meses");
  assert.equal(fmtMonths(12), "1 ano");
  assert.equal(fmtMonths(26), "2 anos e 2 meses");
});

/* ------------------------------- Prompt ------------------------------- */

test("o prompt entrega perfil, alocação e números prontos e proíbe recalcular", () => {
  const g = guard("Arrojado", { initial: 10_000, monthly: 500, years: 10, goal: 100_000 });
  const prompt = buildReadingPrompt(g);
  assert.match(prompt, /Arrojado/);
  assert.match(prompt, /NÃO recalcule nem contradiga/);
  assert.ok(prompt.includes(fmtBRL(g.projection.scenarios.pessimista.finalValue)));
  assert.ok(prompt.includes(fmtBRL(g.projection.scenarios.otimista.finalValue)));
  assert.ok(prompt.includes(fmtPercent(RATES.cdi)));
  assert.match(prompt, /meta de R\$ 100\.000,00/);
  assert.match(prompt, /NUNCA prometa/);
  assert.match(prompt, /tickers/);
});

test("parseReading valida o contrato da IA", () => {
  assert.equal(parseReading({ reading: "  texto  " }), "texto");
  assert.throws(() => parseReading({}), /fora do contrato/);
  assert.throws(() => parseReading({ reading: "  " }), /fora do contrato/);
  assert.throws(() => parseReading(null), /fora do contrato/);
});

/* -------------------------------- Serviço -------------------------------- */

test("sem chave da IA: texto local, identificado como offline (fallback)", async () => {
  const g = guard("Moderado");
  let called = false;
  const svc = createReadingService({ hasKey: () => false, cache: memoryCache(), generate: async () => ((called = true), {}) });
  const out = await svc.get(g);
  assert.equal(out.source, "fallback");
  assert.match(out.fallbackReason!, /GEMINI_API_KEY/);
  assert.equal(out.text, localReading(g));
  assert.equal(called, false);
});

test("texto da IA válido é aceito e identificado como IA", async () => {
  const g = guard("Moderado");
  const good = `Para o perfil Moderado, no cenário base o valor hipotético seria de ${fmtBRL(g.projection.scenarios.base.finalValue)} após ${fmtYears(10)}.`;
  const svc = createReadingService({ hasKey: () => true, cache: memoryCache(), generate: async () => ({ reading: good }) });
  const out = await svc.get(g);
  assert.equal(out.source, "gemini");
  assert.equal(out.text, good);
});

test("IA indisponível (erro): entra o texto local", async () => {
  const g = guard("Conservador");
  const svc = createReadingService({
    hasKey: () => true,
    cache: memoryCache(),
    generate: async () => {
      throw new Error("Gemini respondeu HTTP 503");
    },
  });
  const out = await svc.get(g);
  assert.equal(out.source, "fallback");
  assert.match(out.fallbackReason!, /503/);
  assert.equal(out.text, localReading(g));
});

test("resposta inválida da IA: entra o texto local", async () => {
  const svc = createReadingService({ hasKey: () => true, cache: memoryCache(), generate: async () => ({ resposta: "x" }) });
  const out = await svc.get(guard("Moderado"));
  assert.equal(out.source, "fallback");
  assert.match(out.fallbackReason!, /fora do contrato/);
});

test("texto da IA reprovado (promessa, número diferente, recomendação, ticker) cai no texto local", async () => {
  const g = guard("Moderado");
  const bad = [
    "Você vai ter R$ 500.000,00 garantidos.",
    `No cenário base o valor hipotético seria R$ 123,45.`,
    "Compre ações agora.",
    "Considere PETR4 para o perfil Moderado.",
    "Para o perfil Arrojado, o valor seria alto.",
  ];
  for (const text of bad) {
    const svc = createReadingService({ hasKey: () => true, cache: memoryCache(), generate: async () => ({ reading: text }) });
    const out = await svc.get(g);
    assert.equal(out.source, "fallback", text);
    assert.match(out.fallbackReason!, /reprovado/, text);
    assert.equal(out.text, localReading(g));
  }
});

test("depois de uma falha, a IA não é chamada de novo durante o intervalo de espera", async () => {
  let now = new Date("2026-11-04T12:00:00Z");
  let calls = 0;
  const svc = createReadingService({
    hasKey: () => true,
    now: () => now,
    cache: memoryCache(),
    generate: async () => {
      calls++;
      throw new Error("fora do ar");
    },
  });
  const g = guard("Moderado");
  await svc.get(g);
  await svc.get(g);
  assert.equal(calls, 1);
  now = new Date(now.getTime() + 6 * 60 * 1000);
  await svc.get(g);
  assert.equal(calls, 2);
});

test("um resultado já explicado não gera novo texto (cache)", async () => {
  const g = guard("Moderado");
  const good = `Para o perfil Moderado, o valor hipotético no cenário base seria de ${fmtBRL(g.projection.scenarios.base.finalValue)}.`;
  let calls = 0;
  const svc = createReadingService({
    hasKey: () => true,
    cache: memoryCache(),
    generate: async () => {
      calls++;
      return { reading: good };
    },
  });
  await svc.get(g);
  const again = await svc.get(guard("Moderado"));
  assert.equal(calls, 1);
  assert.equal(again.text, good);
  // entradas diferentes => outro texto
  await svc.get(guard("Moderado", { initial: 1, monthly: 1, years: 2, goal: null })).catch(() => {});
  assert.equal(calls, 2);
});

test("chamadas simultâneas para o mesmo resultado dividem a mesma geração", async () => {
  const g = guard("Moderado");
  const good = `Para o perfil Moderado, no cenário base o valor hipotético seria de ${fmtBRL(g.projection.scenarios.base.finalValue)}.`;
  let calls = 0;
  const svc = createReadingService({
    hasKey: () => true,
    cache: memoryCache(),
    generate: async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 5));
      return { reading: good };
    },
  });
  await Promise.all([svc.get(g), svc.get(g), svc.get(g)]);
  assert.equal(calls, 1);
});

test("texto em cache que não passa mais na verificação é ignorado", async () => {
  const g = guard("Moderado");
  const cache = memoryCache();
  await cache.save(readingCacheKey(g), "Você vai ter muito dinheiro.");
  const svc = createReadingService({ hasKey: () => false, cache });
  const out = await svc.get(g);
  assert.equal(out.source, "fallback");
});

test("falha do cache em banco não quebra a leitura", async () => {
  const g = guard("Moderado");
  const cache = createReadingCache(() => new Date(), {
    getEconomicInsightRow: async () => {
      throw new Error("banco fora do ar");
    },
    saveEconomicInsightRow: async () => {
      throw new Error("banco fora do ar");
    },
  });
  const svc = createReadingService({ hasKey: () => false, cache });
  const out = await svc.get(g);
  assert.equal(out.source, "fallback");
  assert.ok(out.text.length > 0);
});

test("a chave de cache muda com o perfil, as entradas e as taxas", () => {
  const base = readingCacheKey(guard("Moderado"));
  assert.notEqual(base, readingCacheKey(guard("Arrojado")));
  assert.notEqual(base, readingCacheKey(guard("Moderado", { initial: 10_001, monthly: 500, years: 10, goal: null })));
  assert.notEqual(base, readingCacheKey(guard("Moderado", undefined, { cdi: 13, ipca12m: 4.5 })));
  assert.equal(base, readingCacheKey(guard("Moderado")));
  assert.match(base, /^sim\|v\d+\|[0-9a-f]{32}$/);
});
