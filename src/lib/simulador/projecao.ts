/**
 * Cálculo da projeção. Função pura: todo número mostrado ao usuário (e entregue à IA) sai daqui.
 *
 * Mecânica (conferível em planilha):
 * - o aporte inicial e cada aporte mensal são divididos entre as classes pela alocação do perfil;
 * - cada classe rende sozinha, sem rebalanceamento;
 * - taxa mensal m = (1 + taxa anual)^(1/12) − 1;
 * - o aporte mensal entra no FIM de cada mês, depois do rendimento do mês;
 * - por classe: VF = P·(1+m)^n + A·((1+m)^n − 1)/m  (com m = 0: P + A·n).
 */
import { CLASSES, RATE_RULES, SCENARIOS, type Scenario } from "./premissas.ts";
import type { AssetClass } from "../ai/allocation.ts";
import type { SimInput } from "./validacao.ts";

export interface ClassPercent {
  assetClass: AssetClass;
  percent: number;
}

/** CDI e inflação atuais, em % ao ano. */
export interface BaseRates {
  cdi: number;
  ipca12m: number;
}

export interface GoalResult {
  target: number;
  /** Só com o que a pessoa colocou (sem rendimento) a meta já é atingida dentro do prazo. */
  investedAloneReaches: boolean;
  reached: boolean;
  /** Primeiro mês (1 = fim do 1º mês; 0 = já no início) em que o patrimônio hipotético alcança a meta. */
  month: number | null;
  /** Quanto falta ao final do prazo (0 quando atingida). */
  shortfall: number;
}

export interface ScenarioResult {
  scenario: Scenario;
  /** Taxa anual (%) usada em cada classe neste cenário. */
  classRates: Record<AssetClass, number>;
  /** Valor final hipotético (bruto). */
  finalValue: number;
  /** finalValue − total investido (negativo = perda hipotética). */
  earnings: number;
  /** Valor final em poder de compra de hoje (descontada a inflação). */
  realValue: number;
  /** finalValue − valor necessário para só acompanhar a inflação (negativo = abaixo da inflação). */
  vsInflation: number;
  /** Final menor que o total investido. */
  belowInvested: boolean;
  goal: GoalResult | null;
}

export interface SeriesPoint {
  /** Mês (0 = hoje). */
  month: number;
  invested: number;
  inflation: number;
  pessimista: number;
  base: number;
  otimista: number;
}

export interface Projection {
  input: SimInput;
  months: number;
  /** Total que a pessoa colocou do próprio bolso (inicial + aportes). */
  invested: number;
  /** Valor que o mesmo fluxo de aportes teria se só acompanhasse a inflação. */
  inflationValue: number;
  scenarios: Record<Scenario, ScenarioResult>;
  /** Pontos para o gráfico: de ano em ano e o último mês. */
  series: SeriesPoint[];
  rates: BaseRates;
}

const cents = (n: number) => Math.round(n * 100) / 100;
const monthlyRate = (annualPercent: number) => Math.pow(1 + annualPercent / 100, 1 / 12) - 1;

/** Taxa anual (%) de uma classe em um cenário, a partir do CDI e da inflação atuais. */
export function annualRate(assetClass: AssetClass, scenario: Scenario, rates: BaseRates): number {
  const rule = RATE_RULES[assetClass];
  return rule.kind === "cdi" ? (rates.cdi * rule.percentOfCdi[scenario]) / 100 : rates.ipca12m + rule.premium[scenario];
}

export function classRates(scenario: Scenario, rates: BaseRates): Record<AssetClass, number> {
  return Object.fromEntries(CLASSES.map((c) => [c, annualRate(c, scenario, rates)])) as Record<AssetClass, number>;
}

/** Evolução mês a mês (índice 0 = hoje) de um conjunto de classes que rendem à taxa dada por classe. */
function simulate(months: number, initial: number, monthly: number, weights: Record<string, number>, perClassAnnual: (c: AssetClass) => number): number[] {
  const active = CLASSES.filter((c) => (weights[c] ?? 0) > 0);
  const m = Object.fromEntries(active.map((c) => [c, monthlyRate(perClassAnnual(c))]));
  const bal = Object.fromEntries(active.map((c) => [c, initial * weights[c]!]));
  const total: number[] = [active.reduce((s, c) => s + bal[c]!, 0)];
  for (let t = 1; t <= months; t++) {
    let sum = 0;
    for (const c of active) {
      bal[c] = bal[c]! * (1 + m[c]!) + monthly * weights[c]!;
      sum += bal[c]!;
    }
    total.push(sum);
  }
  return total;
}

function goalResult(target: number, totalSeries: number[], input: SimInput, months: number): GoalResult {
  const month = totalSeries.findIndex((v) => v >= target);
  const final = totalSeries[months]!;
  return {
    target,
    investedAloneReaches: input.initial + input.monthly * months >= target,
    reached: month >= 0,
    month: month >= 0 ? month : null,
    shortfall: month >= 0 ? 0 : cents(target - final),
  };
}

export function project(input: SimInput, allocation: ClassPercent[], rates: BaseRates): Projection {
  const sum = allocation.reduce((s, a) => s + a.percent, 0);
  if (Math.abs(sum - 100) > 0.01) throw new Error("A alocação deve somar 100%.");

  const months = Math.round(input.years * 12);
  const weights: Record<string, number> = {};
  for (const a of allocation) weights[a.assetClass] = (weights[a.assetClass] ?? 0) + a.percent / 100;

  const invested = input.initial + input.monthly * months;
  const investedSeries = Array.from({ length: months + 1 }, (_, t) => input.initial + input.monthly * t);
  const inflationSeries = simulate(months, input.initial, input.monthly, { "Renda Fixa": 1 }, () => rates.ipca12m);
  const inflationValue = inflationSeries[months]!;
  const deflator = Math.pow(1 + rates.ipca12m / 100, months / 12);

  const seriesByScenario = {} as Record<Scenario, number[]>;
  const scenarios = {} as Record<Scenario, ScenarioResult>;
  for (const scenario of SCENARIOS) {
    const series = simulate(months, input.initial, input.monthly, weights, (c) => annualRate(c, scenario, rates));
    seriesByScenario[scenario] = series;
    const finalValue = series[months]!;
    scenarios[scenario] = {
      scenario,
      classRates: classRates(scenario, rates),
      finalValue: cents(finalValue),
      earnings: cents(finalValue - invested),
      realValue: cents(finalValue / deflator),
      vsInflation: cents(finalValue - inflationValue),
      belowInvested: cents(finalValue) < cents(invested),
      goal: input.goal !== null ? goalResult(input.goal, series, input, months) : null,
    };
  }

  const points = new Set<number>();
  for (let t = 0; t <= months; t += 12) points.add(t);
  points.add(months);
  const series: SeriesPoint[] = [...points]
    .sort((a, b) => a - b)
    .map((t) => ({
      month: t,
      invested: cents(investedSeries[t]!),
      inflation: cents(inflationSeries[t]!),
      pessimista: cents(seriesByScenario.pessimista[t]!),
      base: cents(seriesByScenario.base[t]!),
      otimista: cents(seriesByScenario.otimista[t]!),
    }));

  return { input, months, invested: cents(invested), inflationValue: cents(inflationValue), scenarios, series, rates };
}

/** Participação (%) das classes de maior risco (fundos imobiliários, ETFs e ações) na alocação. */
export function riskySharePercent(allocation: ClassPercent[]): number {
  return allocation
    .filter((a) => a.assetClass === "Fundos Imobiliários" || a.assetClass === "ETFs" || a.assetClass === "Ações")
    .reduce((s, a) => s + a.percent, 0);
}
