/**
 * Premissas do Simulador de Projeção de Patrimônio — ÚNICO lugar para revisar e alterar as taxas.
 *
 * Todas as taxas são HIPÓTESES DIDÁTICAS para ilustrar possibilidades e a diferença entre perfis.
 * Não são previsões, não são promessas e não vêm de nenhuma série histórica de ativos.
 * Valores brutos: sem impostos, taxas de administração nem corretagem.
 */
import type { AssetClass } from "../ai/allocation.ts";
import type { Profile } from "../suitability/scoring.ts";

/** Perfis na ordem usada nas telas (do mais conservador ao mais agressivo). */
export const PROFILES: Profile[] = ["Conservador", "Moderado", "Arrojado", "Agressivo"];

export type Scenario = "pessimista" | "base" | "otimista";

export const SCENARIOS: Scenario[] = ["pessimista", "base", "otimista"];

export const SCENARIO_LABEL: Record<Scenario, string> = {
  pessimista: "Pessimista",
  base: "Base",
  otimista: "Otimista",
};

/** Classes na ordem usada nas telas e nos textos. */
export const CLASSES: AssetClass[] = ["Renda Fixa", "Fundos", "Fundos Imobiliários", "ETFs", "Ações"];

/**
 * Como a taxa anual de cada classe é obtida em cada cenário:
 * - "cdi": percentual do CDI atual (ex.: 90 = 90% do CDI);
 * - "inflacao": inflação atual somada a um prêmio em pontos percentuais (pode ser negativo).
 */
export type RateRule =
  | { kind: "cdi"; percentOfCdi: Record<Scenario, number> }
  | { kind: "inflacao"; premium: Record<Scenario, number> };

export const RATE_RULES: Record<AssetClass, RateRule> = {
  "Renda Fixa": { kind: "cdi", percentOfCdi: { pessimista: 90, base: 100, otimista: 105 } },
  Fundos: { kind: "cdi", percentOfCdi: { pessimista: 85, base: 100, otimista: 110 } },
  "Fundos Imobiliários": { kind: "inflacao", premium: { pessimista: -3, base: 3.5, otimista: 6.5 } },
  ETFs: { kind: "inflacao", premium: { pessimista: -6, base: 4, otimista: 8 } },
  Ações: { kind: "inflacao", premium: { pessimista: -8, base: 5, otimista: 10 } },
};

/**
 * Valores de referência (% ao ano), usados SOMENTE quando não há CDI/inflação nem dado guardado.
 * São aproximados e a tela avisa isso. Revise de tempos em tempos.
 */
export const REFERENCE_RATES = { cdi: 14.5, ipca12m: 4.5 } as const;

/** Limites dos campos de entrada. */
export const LIMITS = {
  maxInitial: 10_000_000,
  maxMonthly: 1_000_000,
  minYears: 0.5,
  maxYears: 50,
  /** O prazo é aceito em múltiplos deste passo (em anos). */
  yearsStep: 0.5,
  maxGoal: 1_000_000_000,
} as const;

/** Abaixo deste prazo (em anos) a tela avisa que a simulação é pouco representativa. */
export const SHORT_TERM_YEARS = 1;

/** Muda quando as regras acima mudam; vai junto da chave de cache da leitura da IA. */
export const ASSUMPTIONS_VERSION = 1;
