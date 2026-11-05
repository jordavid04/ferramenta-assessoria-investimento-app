import { test } from "node:test";
import assert from "node:assert/strict";
import { BASE_ALLOCATION } from "../ai/allocation.ts";
import { annualRate, project, riskySharePercent, type BaseRates, type ClassPercent } from "./projecao.ts";
import { CLASSES, RATE_RULES, SCENARIOS } from "./premissas.ts";
import { baseAllocation } from "./perfil.ts";
import type { SimInput } from "./validacao.ts";

const RATES: BaseRates = { cdi: 14.5, ipca12m: 4.5 };
const close = (a: number, b: number, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} deveria estar a ${tol} de ${b}`);

/** Fórmula fechada da planilha: VF = P·(1+m)^n + A·((1+m)^n − 1)/m, por classe. */
function planilha(input: SimInput, allocation: ClassPercent[], annualPercentOf: (c: ClassPercent["assetClass"]) => number): number {
  const n = Math.round(input.years * 12);
  return allocation.reduce((sum, a) => {
    const m = Math.pow(1 + annualPercentOf(a.assetClass) / 100, 1 / 12) - 1;
    const w = a.percent / 100;
    const growth = Math.pow(1 + m, n);
    const annuity = m === 0 ? n : (growth - 1) / m;
    return sum + input.initial * w * growth + input.monthly * w * annuity;
  }, 0);
}

test("caso feito à mão: R$ 1.000 em renda fixa por 1 ano a 12% ao ano", () => {
  const p = project({ initial: 1000, monthly: 0, years: 1, goal: null }, [{ assetClass: "Renda Fixa", percent: 100 }], { cdi: 12, ipca12m: 5 });
  assert.equal(p.scenarios.base.finalValue, 1120);
  assert.equal(p.scenarios.pessimista.finalValue, 1108); // 90% do CDI = 10,8%
  assert.equal(p.scenarios.otimista.finalValue, 1126); // 105% do CDI = 12,6%
  assert.equal(p.invested, 1000);
  assert.equal(p.scenarios.base.earnings, 120);
  assert.equal(p.scenarios.base.realValue, 1066.67); // 1120 / 1,05
  assert.equal(p.inflationValue, 1050);
  assert.equal(p.scenarios.base.vsInflation, 70);
});

test("confere com a fórmula da planilha para dois perfis (Conservador e Agressivo)", () => {
  const input: SimInput = { initial: 10_000, monthly: 500, years: 10, goal: null };
  for (const profile of ["Conservador", "Agressivo"] as const) {
    const allocation = baseAllocation(profile);
    const p = project(input, allocation, RATES);
    for (const s of SCENARIOS) {
      close(p.scenarios[s].finalValue, planilha(input, allocation, (c) => annualRate(c, s, RATES)), 0.05);
    }
    assert.equal(p.invested, 10_000 + 500 * 120);
  }
});

test("exemplo numérico da entrega (Moderado, R$ 10.000 + R$ 500/mês por 10 anos, CDI 14,5% e IPCA 4,5%)", () => {
  const p = project({ initial: 10_000, monthly: 500, years: 10, goal: null }, baseAllocation("Moderado"), RATES);
  // Valores de referência conferidos pela fórmula fechada acima; se as premissas mudarem, atualize junto.
  const expected = (s: (typeof SCENARIOS)[number]) => planilha({ initial: 10_000, monthly: 500, years: 10, goal: null }, baseAllocation("Moderado"), (c) => annualRate(c, s, RATES));
  for (const s of SCENARIOS) close(p.scenarios[s].finalValue, expected(s), 0.05);
  assert.ok(p.scenarios.pessimista.finalValue < p.scenarios.base.finalValue);
  assert.ok(p.scenarios.base.finalValue < p.scenarios.otimista.finalValue);
});

test("as taxas seguem a tabela de premissas", () => {
  assert.equal(annualRate("Renda Fixa", "base", RATES), 14.5);
  close(annualRate("Renda Fixa", "pessimista", RATES), 13.05, 1e-9);
  close(annualRate("Fundos", "pessimista", RATES), 12.325, 1e-9);
  close(annualRate("Renda Fixa", "otimista", RATES), 15.225, 1e-9);
  close(annualRate("Fundos", "otimista", RATES), 15.95, 1e-9);
  close(annualRate("Ações", "pessimista", RATES), -3.5, 1e-9);
  close(annualRate("Ações", "base", RATES), 9.5, 1e-9);
  close(annualRate("Ações", "otimista", RATES), 14.5, 1e-9);
  close(annualRate("ETFs", "pessimista", RATES), -1.5, 1e-9);
  close(annualRate("ETFs", "base", RATES), 8.5, 1e-9);
  close(annualRate("ETFs", "otimista", RATES), 12.5, 1e-9);
  close(annualRate("Fundos Imobiliários", "pessimista", RATES), 1.5, 1e-9);
  close(annualRate("Fundos Imobiliários", "base", RATES), 8, 1e-9);
  close(annualRate("Fundos Imobiliários", "otimista", RATES), 11, 1e-9);
});

test("o cenário pessimista tem resultado negativo nas classes de maior risco (ações e ETFs)", () => {
  assert.ok(annualRate("Ações", "pessimista", RATES) < 0);
  assert.ok(annualRate("ETFs", "pessimista", RATES) < 0);
  // mesmo com inflação alta nas premissas, FIIs ficam abaixo da inflação
  assert.ok(annualRate("Fundos Imobiliários", "pessimista", RATES) < RATES.ipca12m);
});

test("a faixa pessimista–otimista é mais larga para perfis mais arrojados", () => {
  const input: SimInput = { initial: 10_000, monthly: 500, years: 10, goal: null };
  const width = (profile: keyof typeof BASE_ALLOCATION) => {
    const p = project(input, baseAllocation(profile), RATES);
    return p.scenarios.otimista.finalValue - p.scenarios.pessimista.finalValue;
  };
  assert.ok(width("Conservador") < width("Moderado"));
  assert.ok(width("Moderado") < width("Arrojado"));
  assert.ok(width("Arrojado") < width("Agressivo"));
});

test("trocar de perfil muda a projeção", () => {
  const input: SimInput = { initial: 5_000, monthly: 300, years: 8, goal: null };
  const a = project(input, baseAllocation("Conservador"), RATES);
  const b = project(input, baseAllocation("Agressivo"), RATES);
  assert.notEqual(a.scenarios.base.finalValue, b.scenarios.base.finalValue);
});

test("aporte inicial zero com aporte mensal positivo", () => {
  const input: SimInput = { initial: 0, monthly: 1000, years: 5, goal: null };
  const p = project(input, baseAllocation("Moderado"), RATES);
  assert.equal(p.invested, 60_000);
  close(p.scenarios.base.finalValue, planilha(input, baseAllocation("Moderado"), (c) => annualRate(c, "base", RATES)), 0.05);
  assert.equal(p.series[0]!.base, 0);
});

test("só aporte inicial, sem aporte mensal", () => {
  const input: SimInput = { initial: 20_000, monthly: 0, years: 3, goal: null };
  const p = project(input, baseAllocation("Arrojado"), RATES);
  assert.equal(p.invested, 20_000);
  close(p.scenarios.base.finalValue, planilha(input, baseAllocation("Arrojado"), (c) => annualRate(c, "base", RATES)), 0.05);
});

test("taxa mensal zero não quebra a conta (renda fixa com CDI 0)", () => {
  const p = project({ initial: 100, monthly: 10, years: 1, goal: null }, [{ assetClass: "Renda Fixa", percent: 100 }], { cdi: 0, ipca12m: 0 });
  assert.equal(p.scenarios.base.finalValue, 220);
  assert.equal(p.inflationValue, 220);
});

test("pessimista abaixo do total investido é sinalizado (perda possível)", () => {
  const p = project({ initial: 10_000, monthly: 0, years: 5, goal: null }, baseAllocation("Agressivo"), { cdi: 4, ipca12m: 3 });
  assert.equal(p.scenarios.pessimista.belowInvested, true);
  assert.ok(p.scenarios.pessimista.earnings < 0);
  assert.equal(p.scenarios.otimista.belowInvested, false);
});

test("a série do gráfico começa no mês 0, vai de ano em ano e termina no último mês", () => {
  const p = project({ initial: 1000, monthly: 100, years: 2.5, goal: null }, baseAllocation("Moderado"), RATES);
  assert.deepEqual(p.series.map((s) => s.month), [0, 12, 24, 30]);
  assert.equal(p.series.at(-1)!.base, p.scenarios.base.finalValue);
  assert.equal(p.series.at(-1)!.invested, p.invested);
});

test("meta atingida dentro do prazo: informa o mês", () => {
  const p = project({ initial: 0, monthly: 1000, years: 5, goal: 30_000 }, [{ assetClass: "Renda Fixa", percent: 100 }], { cdi: 12, ipca12m: 4 });
  const g = p.scenarios.base.goal!;
  assert.equal(g.reached, true);
  assert.ok(g.month! > 0 && g.month! < 30, `mês ${g.month}`); // com juros chega antes de 30 aportes
  assert.equal(g.shortfall, 0);
  assert.equal(g.investedAloneReaches, true); // 60 mil investidos > 30 mil
});

test("meta não atingida: informa quanto falta", () => {
  const p = project({ initial: 1000, monthly: 100, years: 1, goal: 1_000_000 }, baseAllocation("Moderado"), RATES);
  const g = p.scenarios.base.goal!;
  assert.equal(g.reached, false);
  assert.equal(g.month, null);
  assert.equal(g.shortfall, Math.round((1_000_000 - p.scenarios.base.finalValue) * 100) / 100);
  assert.equal(g.investedAloneReaches, false);
});

test("meta já atingida só com o que a pessoa investiu, sem rendimento", () => {
  // Pessimista com perdas: a pessoa investe 50 mil no total, a meta é 40 mil.
  const p = project({ initial: 50_000, monthly: 0, years: 3, goal: 40_000 }, baseAllocation("Agressivo"), { cdi: 4, ipca12m: 3 });
  for (const s of SCENARIOS) assert.equal(p.scenarios[s].goal!.investedAloneReaches, true);
  assert.equal(p.scenarios.base.goal!.month, 0); // já no início
});

test("sem meta, o resultado não traz bloco de meta", () => {
  const p = project({ initial: 1000, monthly: 0, years: 1, goal: null }, baseAllocation("Moderado"), RATES);
  for (const s of SCENARIOS) assert.equal(p.scenarios[s].goal, null);
});

test("poder de compra de hoje é o valor final dividido pela inflação do período", () => {
  const p = project({ initial: 10_000, monthly: 0, years: 4, goal: null }, baseAllocation("Moderado"), RATES);
  for (const s of SCENARIOS) {
    close(p.scenarios[s].realValue, p.scenarios[s].finalValue / Math.pow(1.045, 4), 0.01);
  }
});

test("a alocação precisa somar 100%", () => {
  assert.throws(() => project({ initial: 1, monthly: 0, years: 1, goal: null }, [{ assetClass: "Renda Fixa", percent: 90 }], RATES), /100%/);
});

test("alocação-base: classes de risco crescem com o perfil", () => {
  assert.equal(riskySharePercent(baseAllocation("Conservador")), 10);
  assert.equal(riskySharePercent(baseAllocation("Moderado")), 30);
  assert.equal(riskySharePercent(baseAllocation("Arrojado")), 60);
  assert.equal(riskySharePercent(baseAllocation("Agressivo")), 75);
});

test("todas as classes têm regra de taxa para os três cenários", () => {
  for (const c of CLASSES) {
    const rule = RATE_RULES[c];
    const values = rule.kind === "cdi" ? rule.percentOfCdi : rule.premium;
    for (const s of SCENARIOS) assert.ok(Number.isFinite(values[s]), `${c}/${s}`);
    // pessimista <= base <= otimista
    assert.ok(values.pessimista < values.base && values.base < values.otimista, c);
  }
});
