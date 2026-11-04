/**
 * Primitivas do painel econômico: tipos, leitura das séries do BCB e cálculos.
 * Todos os números exibidos ou enviados à IA saem daqui — a IA nunca calcula nada.
 */

export type IndicatorId = "selic" | "cdi" | "ipca" | "dolar";

export const INDICATOR_IDS: IndicatorId[] = ["selic", "cdi", "ipca", "dolar"];

/** Códigos das séries no SGS (Sistema Gerenciador de Séries Temporais) do Banco Central. */
export const SGS_CODES: Record<IndicatorId, number> = {
  selic: 432, // Meta Selic (% a.a.)
  cdi: 4389, // CDI anualizado base 252 (% a.a.)
  ipca: 433, // IPCA variação mensal (%)
  dolar: 1, // Dólar comercial, venda (PTAX), em R$
};

export interface Point {
  /** Data ISO (yyyy-mm-dd). Para o IPCA, é o primeiro dia do mês de referência. */
  date: string;
  value: number;
}

export type Trend = "alta" | "queda" | "estavel";

const DAY = 86_400_000;

export function toUtcMs(iso: string): number {
  return Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
}

export function toIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function shiftDays(iso: string, days: number): string {
  return toIso(toUtcMs(iso) + days * DAY);
}

export function diffDays(aIso: string, bIso: string): number {
  return Math.round((toUtcMs(aIso) - toUtcMs(bIso)) / DAY);
}

/** "dd/MM/yyyy" (formato do BCB) -> "yyyy-MM-dd", ou null se inválida. */
export function parseBcbDate(s: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const ms = Date.parse(`${iso}T00:00:00Z`);
  return Number.isNaN(ms) || toIso(ms) !== iso ? null : iso;
}

/** Valida o JSON do BCB ([{data:"dd/MM/yyyy", valor:"13.75"}]). Lança erro se estiver fora do formato. */
export function parseBcbSeries(raw: unknown): Point[] {
  if (!Array.isArray(raw)) throw new Error("Resposta do BCB fora do formato esperado");
  const points: Point[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const { data, valor } = item as { data?: unknown; valor?: unknown };
    if (typeof data !== "string") continue;
    if (typeof valor !== "string" && typeof valor !== "number") continue;
    if (typeof valor === "string" && valor.trim() === "") continue;
    const date = parseBcbDate(data);
    const value = Number(valor);
    if (date && Number.isFinite(value)) points.push({ date, value });
  }
  if (points.length === 0) throw new Error("Série do BCB sem dados válidos");
  return points.sort((a, b) => a.date.localeCompare(b.date));
}

function monthIndex(iso: string): number {
  return Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7));
}

/**
 * IPCA acumulado em 12 meses, composto a partir das variações mensais.
 * Só existe quando há 12 meses consecutivos; senão devolve [] (nunca "chuta" um valor).
 */
export function rollingInflation12m(monthly: Point[]): Point[] {
  const out: Point[] = [];
  for (let i = 11; i < monthly.length; i++) {
    const window = monthly.slice(i - 11, i + 1);
    const consecutive = window.every((p, k) => k === 0 || monthIndex(p.date) === monthIndex(window[k - 1].date) + 1);
    if (!consecutive) continue;
    const factor = window.reduce((acc, p) => acc * (1 + p.value / 100), 1);
    out.push({ date: monthly[i].date, value: (factor - 1) * 100 });
  }
  return out;
}

/** IPCA acumulado nos últimos 12 meses (em %), ou null se faltarem meses. */
export function accumulatedInflation12m(monthly: Point[]): number | null {
  const last = rollingInflation12m(monthly.slice(-12)).at(-1);
  return last ? last.value : null;
}

/**
 * Juro real pela fórmula de Fisher: ((1 + Selic) / (1 + inflação)) − 1.
 * Entradas e saída em % ao ano.
 */
export function realRate(selicPct: number, ipca12mPct: number): number {
  return ((1 + selicPct / 100) / (1 + ipca12mPct / 100) - 1) * 100;
}

/**
 * Compara o valor atual com o anterior. Variações menores que `limit` contam como "estável".
 * Com `relative`, `limit` e a variação são percentuais sobre o valor anterior.
 */
export function trend(current: number, previous: number | null | undefined, limit: number, relative = false): Trend | null {
  if (previous === null || previous === undefined || !Number.isFinite(previous)) return null;
  const raw = relative ? (previous === 0 ? 0 : ((current - previous) / Math.abs(previous)) * 100) : current - previous;
  const delta = Math.round(raw * 1e6) / 1e6;
  if (Math.abs(delta) < limit) return "estavel";
  return delta > 0 ? "alta" : "queda";
}

/** Último ponto com data igual ou anterior a `iso` (série em ordem crescente). */
export function pointOnOrBefore(points: Point[], iso: string): Point | null {
  for (let i = points.length - 1; i >= 0; i--) if (points[i].date <= iso) return points[i];
  return null;
}

/** Dado considerado antigo quando a data de referência passa de `maxDays` dias. */
export function isStale(iso: string, maxDays: number, now: Date): boolean {
  return diffDays(toIso(now.getTime()), iso) > maxDays;
}

/** Reduz uma série diária a um ponto por semana (o último), sempre mantendo o ponto final. */
export function downsampleWeekly(points: Point[]): Point[] {
  const out: Point[] = [];
  let bucket = Number.NaN;
  for (const p of points) {
    const b = Math.floor(toUtcMs(p.date) / (7 * DAY));
    if (b === bucket) out[out.length - 1] = p;
    else {
      out.push(p);
      bucket = b;
    }
  }
  return out;
}
