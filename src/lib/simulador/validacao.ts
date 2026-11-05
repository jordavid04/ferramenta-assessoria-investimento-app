/** Validação das entradas do simulador. As mensagens seguem o padrão do sistema (pt-BR, diretas). */
import { fmtBRL, fmtNumber } from "../economia/format.ts";
import { LIMITS } from "./premissas.ts";

export interface SimInput {
  /** Valor que a pessoa já tem para investir hoje (R$). */
  initial: number;
  /** Aporte mensal (R$). */
  monthly: number;
  /** Prazo em anos. */
  years: number;
  /** Meta de patrimônio (R$), se informada. */
  goal: number | null;
}

export type InputField = "initial" | "monthly" | "years" | "goal";

export type ValidationResult =
  | { ok: true; value: SimInput }
  | { ok: false; error: string; fields: Partial<Record<InputField, string>> };

function isBlank(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
}

/** Aceita número ou texto numérico simples ("1500.50"); formato pt-BR deve ser convertido antes pela tela. */
function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return /^-?\d+(\.\d+)?$/.test(v.trim()) ? Number(v.trim()) : Number.NaN;
  return Number.NaN;
}

export function validateInput(raw: unknown): ValidationResult {
  const body = (raw ?? {}) as Record<string, unknown>;
  const fields: Partial<Record<InputField, string>> = {};

  const money = (key: "initial" | "monthly", label: string, max: number): number => {
    const v = body[key];
    if (isBlank(v)) {
      fields[key] = `Informe ${label} (use 0 se não houver).`;
      return 0;
    }
    const n = toNumber(v);
    if (!Number.isFinite(n)) fields[key] = `${capitalize(label)} deve ser um número.`;
    else if (n < 0) fields[key] = `${capitalize(label)} não pode ser negativo.`;
    else if (n > max) fields[key] = `${capitalize(label)} pode ser de no máximo ${fmtBRL(max)}.`;
    return n;
  };

  const initial = money("initial", "o valor que você já tem para investir", LIMITS.maxInitial);
  const monthly = money("monthly", "o valor que pretende investir por mês", LIMITS.maxMonthly);

  let years = 0;
  if (isBlank(body.years)) fields.years = "Informe o prazo em anos.";
  else {
    years = toNumber(body.years);
    if (!Number.isFinite(years)) fields.years = "O prazo deve ser um número de anos.";
    else if (years < LIMITS.minYears || years > LIMITS.maxYears) {
      fields.years = `O prazo deve ficar entre ${fmtNumber(LIMITS.minYears, 1)} e ${LIMITS.maxYears} anos.`;
    } else if (Math.abs(years / LIMITS.yearsStep - Math.round(years / LIMITS.yearsStep)) > 1e-9) {
      fields.years = `Informe o prazo em múltiplos de ${fmtNumber(LIMITS.yearsStep, 1)} ano (por exemplo, 5 ou 7,5).`;
    }
  }

  let goal: number | null = null;
  if (!isBlank(body.goal)) {
    const n = toNumber(body.goal);
    if (!Number.isFinite(n)) fields.goal = "A meta deve ser um número.";
    else if (n <= 0) fields.goal = "A meta deve ser maior que zero (ou deixe o campo em branco).";
    else if (n > LIMITS.maxGoal) fields.goal = `A meta pode ser de no máximo ${fmtBRL(LIMITS.maxGoal)}.`;
    else goal = n;
  }

  if (!fields.initial && !fields.monthly && initial === 0 && monthly === 0) {
    fields.initial = "Informe um valor inicial ou um aporte mensal maior que zero.";
  }

  const messages = Object.values(fields);
  if (messages.length > 0) return { ok: false, error: messages[0]!, fields };
  return { ok: true, value: { initial, monthly, years, goal } };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
