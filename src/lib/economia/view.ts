/** Transforma as séries guardadas nos dados que a página exibe (cartões, histórico, juro real). */
import {
  downsampleWeekly,
  INDICATOR_IDS,
  isStale,
  pointOnOrBefore,
  realRate,
  rollingInflation12m,
  shiftDays,
  trend,
  type IndicatorId,
  type Point,
  type Trend,
} from "./indicators.ts";

/** Série guardada de um indicador e quando ela foi consultada na fonte. */
export interface StoredIndicator {
  points: Point[];
  fetchedAt: string;
}

export type StoredData = Partial<Record<IndicatorId, StoredIndicator>>;

export interface IndicatorView {
  id: IndicatorId;
  label: string;
  unit: "% a.a." | "% em 12 meses" | "R$";
  granularity: "dia" | "mes";
  value: number | null;
  /** Data de referência do valor (para o IPCA, o mês). */
  date: string | null;
  previousValue: number | null;
  trend: Trend | null;
  /** Texto da comparação: "em relação a 30 dias antes" / "em relação ao mês anterior". */
  comparison: string;
  /** Dado ausente-ou-antigo: a página avisa em vez de mostrar como se fosse atual. */
  stale: boolean;
  /** IPCA: variação do último mês, como apoio ao acumulado em 12 meses. */
  monthly: Point | null;
  history: Point[];
}

export interface RealRateView {
  value: number;
  selic: number;
  ipca12m: number;
  selicDate: string;
  ipcaDate: string;
  stale: boolean;
}

interface Config {
  label: string;
  unit: IndicatorView["unit"];
  /** Variação mínima para não contar como "estável". */
  limit: number;
  relative: boolean;
  staleDays: number;
}

const CONFIG: Record<IndicatorId, Config> = {
  selic: { label: "Taxa Selic", unit: "% a.a.", limit: 0.05, relative: false, staleDays: 7 },
  cdi: { label: "Taxa CDI", unit: "% a.a.", limit: 0.05, relative: false, staleDays: 7 },
  ipca: { label: "Inflação (IPCA)", unit: "% em 12 meses", limit: 0.05, relative: false, staleDays: 75 },
  dolar: { label: "Dólar (venda)", unit: "R$", limit: 0.5, relative: true, staleDays: 7 },
};

const COMPARE_DAYS = 30;

function emptyView(id: IndicatorId): IndicatorView {
  const c = CONFIG[id];
  return {
    id,
    label: c.label,
    unit: c.unit,
    granularity: id === "ipca" ? "mes" : "dia",
    value: null,
    date: null,
    previousValue: null,
    trend: null,
    comparison: id === "ipca" ? "em relação ao mês anterior" : `em relação a ${COMPARE_DAYS} dias antes`,
    stale: true,
    monthly: null,
    history: [],
  };
}

export function buildIndicatorView(id: IndicatorId, stored: StoredIndicator | undefined, now: Date): IndicatorView {
  const base = emptyView(id);
  const points = stored?.points ?? [];
  if (points.length === 0) return base;
  const c = CONFIG[id];

  if (id === "ipca") {
    const rolling = rollingInflation12m(points);
    const last = rolling.at(-1) ?? null;
    const prev = rolling.at(-2) ?? null;
    const lastMonthly = points.at(-1)!;
    return {
      ...base,
      value: last?.value ?? null,
      date: last?.date ?? lastMonthly.date,
      previousValue: prev?.value ?? null,
      trend: last ? trend(last.value, prev?.value, c.limit) : null,
      stale: !last || isStale(lastMonthly.date, c.staleDays, now),
      monthly: lastMonthly,
      history: rolling,
    };
  }

  const last = points.at(-1)!;
  const prev = pointOnOrBefore(points, shiftDays(last.date, -COMPARE_DAYS));
  return {
    ...base,
    value: last.value,
    date: last.date,
    previousValue: prev?.value ?? null,
    trend: trend(last.value, prev?.value, c.limit, c.relative),
    stale: isStale(last.date, c.staleDays, now),
    history: downsampleWeekly(points),
  };
}

export function buildIndicatorViews(data: StoredData, now: Date): IndicatorView[] {
  return INDICATOR_IDS.map((id) => buildIndicatorView(id, data[id], now));
}

/** Juro real (Selic × IPCA 12 meses). Só existe quando os dois indicadores estão disponíveis. */
export function buildRealRate(views: IndicatorView[]): RealRateView | null {
  const selic = views.find((v) => v.id === "selic");
  const ipca = views.find((v) => v.id === "ipca");
  if (!selic || !ipca || selic.value === null || ipca.value === null || !selic.date || !ipca.date) return null;
  return {
    value: realRate(selic.value, ipca.value),
    selic: selic.value,
    ipca12m: ipca.value,
    selicDate: selic.date,
    ipcaDate: ipca.date,
    stale: selic.stale || ipca.stale,
  };
}
