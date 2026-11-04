import { test } from "node:test";
import assert from "node:assert/strict";
import { allowedNumbersFor, checkInsight, checkInsightText, type EconomicInsight, type GuardContext } from "./content-guard.ts";
import { localInsight } from "./insight.ts";
import type { ScenarioFacts } from "./scenario.ts";
import type { Profile } from "../suitability/scoring.ts";

const facts: ScenarioFacts = { selic: 13.75, cdi: 13.65, ipca12m: 4.58, realRate: 8.82, selicTrend: "estavel", ipcaTrend: "alta", dolarTrend: "queda" };
const ctx = (profile: Profile | null): GuardContext => ({ profile, allowedNumbers: allowedNumbersFor(facts, profile) });

test("texto educativo com números fornecidos é aceito", () => {
  const t = "Com a Selic em 13,75% ao ano e a inflação em 4,58%, a renda fixa fica mais atrativa para o perfil Conservador.";
  assert.deepEqual(checkInsightText(t, ctx("Conservador")), []);
});

test("rejeita códigos de negociação (tickers)", () => {
  for (const t of ["Considere PETR4 para dividendos.", "O fundo HGLG11 paga renda.", "ETFs como BOVA11 diversificam."]) {
    assert.ok(checkInsightText(t, ctx(null)).some((r) => /ativo específico/.test(r)), t);
  }
});

test("rejeita promessa de ganho", () => {
  for (const t of [
    "Esse investimento é garantido.",
    "A renda fixa dá garantia de retorno.",
    "Há retorno certo na renda fixa.",
    "Sem risco algum.",
    "A bolsa vai valorizar muito.",
    "A renda fixa rende 15% neste cenário.",
    "Rentabilidade de 12% ao ano.",
    "Você pode ter ganho de até 10% ao ano.",
    "Os fundos podem render mais de 20%.",
    "Retorno de 9,5% é esperado.",
  ]) {
    assert.ok(checkInsightText(t, ctx(null)).includes("promessa de ganho"), t);
  }
});

test("citar a inflação ou a Selic perto de 'ganhos' não é promessa (caso real do Gemini)", () => {
  // Texto real devolvido pelo Gemini: o 4,58% é a inflação fornecida, não um retorno prometido.
  const t = "O juro real em 8,77% ao ano favorece ganhos acima da inflação de 4,58%. A Selic de 13,75% mantém o retorno da renda fixa atrativo.";
  assert.deepEqual(checkInsightText(t, ctx(null)).filter((r) => r === "promessa de ganho"), []);
});

test("rejeita linguagem de recomendação individual", () => {
  for (const t of ["Compre títulos públicos agora.", "É hora de vender ações.", "Eu recomendo a renda fixa.", "Você deve investir em renda fixa.", "Invista em fundos DI.", "Esse é o melhor momento para entrar."]) {
    assert.ok(checkInsightText(t, ctx(null)).length > 0, t);
  }
});

test("rejeita números que o sistema não forneceu (%, R$)", () => {
  assert.ok(checkInsightText("A Selic deve chegar a 9,5% no ano.", ctx(null)).some((r) => /não forneceu/.test(r)));
  assert.ok(checkInsightText("O dólar custa R$ 5,48.", ctx(null)).some((r) => /não forneceu/.test(r)));
  // números sem % ou R$ (prazos, contagens) não são conferidos
  assert.deepEqual(checkInsightText("Em 12 meses, a renda fixa e outras 4 classes mudam.", ctx(null)), []);
});

test("aceita arredondamentos dos números fornecidos e usa o valor absoluto", () => {
  assert.deepEqual(checkInsightText("A Selic está em 13,8% e a inflação em 4,6%.", ctx(null)), []);
  assert.deepEqual(checkInsightText("O juro real está em 8,82% ao ano.", ctx(null)), []);
  const neg: GuardContext = { profile: null, allowedNumbers: [-1.2] };
  assert.deepEqual(checkInsightText("O juro real está negativo em -1,2% ao ano.", neg), []);
});

test("percentuais da alocação-base do perfil são aceitos, os de outro perfil não", () => {
  assert.deepEqual(checkInsightText("Renda fixa concentra 80% da alocação-base.", ctx("Conservador")), []);
  assert.ok(checkInsightText("Renda fixa concentra 60% da alocação-base.", ctx("Conservador")).length > 0);
});

test("rejeita menção a perfil diferente do da conta; leitura geral pode citar perfis", () => {
  assert.ok(checkInsightText("Para o perfil Agressivo, o cenário pesa.", ctx("Conservador")).some((r) => /perfil diferente/.test(r)));
  assert.deepEqual(checkInsightText("Para o perfil Conservador, o cenário ajuda.", ctx("Conservador")), []);
  assert.deepEqual(checkInsightText("Um investidor conservador tende a gostar de juros altos.", ctx(null)), []);
  // adjetivo comum não é menção a perfil
  assert.deepEqual(checkInsightText("A inflação está em nível moderado.", ctx("Conservador")), []);
  assert.ok(checkInsightText("Um investidor mais agressivo sentiria o efeito.", ctx("Conservador")).length > 0);
});

test("rejeita markup, links, classe desconhecida e texto longo demais", () => {
  assert.ok(checkInsightText("Veja https://exemplo.com", ctx(null)).length > 0);
  assert.ok(checkInsightText("**negrito**", ctx(null)).length > 0);
  const base: EconomicInsight = { reading: "ok", classNotes: [{ assetClass: "Renda Fixa", note: "ok" }] };
  assert.equal(checkInsight(base, ctx(null)).ok, true);
  assert.equal(checkInsight({ ...base, reading: "a".repeat(901) }, ctx(null)).ok, false);
  assert.equal(checkInsight({ ...base, classNotes: [{ assetClass: "Criptomoedas" as never, note: "ok" }] }, ctx(null)).ok, false);
  assert.equal(checkInsight({ ...base, classNotes: [] }, ctx(null)).ok, false);
});

test("TODO texto local passa na verificação (perfis × cenários, e leitura geral)", () => {
  const selics = [14.9, 10.5, 6.5];
  const ipcas = [6.0, 3.8, 2.4];
  const trends = ["alta", "queda", "estavel", null] as const;
  const profiles: (Profile | null)[] = ["Conservador", "Moderado", "Arrojado", "Agressivo", null];
  let n = 0;
  for (const profile of profiles)
    for (const selic of selics)
      for (const ipca12m of ipcas)
        for (const t of trends) {
          const real = (((1 + selic / 100) / (1 + ipca12m / 100)) - 1) * 100;
          const f: ScenarioFacts = {
            selic,
            cdi: selic - 0.1,
            ipca12m,
            realRate: Math.round(real * 100) / 100,
            selicTrend: t,
            ipcaTrend: t,
            dolarTrend: t,
          };
          const insight = localInsight(profile, f);
          const res = checkInsight(insight, { profile, allowedNumbers: allowedNumbersFor(f, profile) });
          assert.deepEqual(res.reasons, [], `${profile} selic=${selic} ipca=${ipca12m} t=${t}: ${insight.reading}`);
          n++;
        }
  assert.equal(n, 5 * 3 * 3 * 4);
});

test("juro real negativo e dados faltando também geram texto local válido", () => {
  const f: ScenarioFacts = { selic: 4, cdi: null, ipca12m: 6, realRate: -1.89, selicTrend: null, ipcaTrend: null, dolarTrend: null };
  const insight = localInsight("Moderado", f);
  assert.match(insight.reading, /negativo/);
  assert.deepEqual(checkInsight(insight, { profile: "Moderado", allowedNumbers: allowedNumbersFor(f, "Moderado") }).reasons, []);
});
