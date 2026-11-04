/** Cliente dos dados abertos do Banco Central (SGS). Gratuito e sem cadastro. */
import { INDICATOR_IDS, parseBcbSeries, SGS_CODES, type IndicatorId, type Point } from "./indicators.ts";

const DEFAULT_BASE_URL = "https://api.bcb.gov.br";
const TIMEOUT_MS = 10_000;

/** Anos de histórico por indicador. O IPCA busca 1 ano a mais para o acumulado em 12 meses cobrir os 5 anos. */
const HISTORY_YEARS: Record<IndicatorId, number> = { selic: 5, cdi: 5, dolar: 5, ipca: 6 };

function bcbDate(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

export function seriesUrl(id: IndicatorId, now: Date): string {
  const base = (process.env.BCB_API_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const start = new Date(Date.UTC(now.getUTCFullYear() - HISTORY_YEARS[id], now.getUTCMonth(), now.getUTCDate()));
  const params = new URLSearchParams({ formato: "json", dataInicial: bcbDate(start), dataFinal: bcbDate(now) });
  return `${base}/dados/serie/bcdata.sgs.${SGS_CODES[id]}/dados?${params}`;
}

/** Busca uma série. Lança erro em qualquer falha (rede, timeout, HTTP, JSON ou formato inválido). */
export async function fetchSeries(id: IndicatorId, now: Date = new Date()): Promise<Point[]> {
  const res = await fetch(seriesUrl(id, now), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`BCB respondeu HTTP ${res.status} (série ${SGS_CODES[id]})`);
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`BCB devolveu resposta que não é JSON (série ${SGS_CODES[id]})`);
  }
  return parseBcbSeries(json);
}

export interface FetchAllResult {
  data: Partial<Record<IndicatorId, Point[]>>;
  /** Indicadores que falharam: a falha de um não derruba os outros. */
  failed: IndicatorId[];
}

export type FetchAll = (now: Date) => Promise<FetchAllResult>;

export const fetchAllIndicators: FetchAll = async (now) => {
  const results = await Promise.allSettled(INDICATOR_IDS.map((id) => fetchSeries(id, now)));
  const data: FetchAllResult["data"] = {};
  const failed: IndicatorId[] = [];
  results.forEach((r, i) => {
    const id = INDICATOR_IDS[i];
    if (r.status === "fulfilled") data[id] = r.value;
    else {
      failed.push(id);
      console.warn("[Economia] falha ao consultar o BCB", { indicador: id, motivo: r.reason instanceof Error ? r.reason.message : String(r.reason) });
    }
  });
  return { data, failed };
};
