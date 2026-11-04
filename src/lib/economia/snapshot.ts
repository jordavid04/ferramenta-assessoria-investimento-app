/**
 * Orquestra o painel: usa o dado guardado enquanto estiver recente, consulta o BCB quando
 * precisa e, se a fonte falhar, mostra o último dado guardado em vez de quebrar a página.
 */
import { fetchAllIndicators, type FetchAll } from "./bcb.ts";
import { INDICATOR_IDS } from "./indicators.ts";
import { getDefaultStore, type EconomicStore } from "./store.ts";
import { buildIndicatorViews, buildRealRate, type IndicatorView, type RealRateView, type StoredData } from "./view.ts";

/** Tempo que um dado consultado é reaproveitado antes de ir de novo à fonte. */
export const SNAPSHOT_TTL_MS = 6 * 60 * 60 * 1000;
/** Depois de uma falha da fonte, espera antes de tentar de novo (não sobrecarregar o serviço gratuito). */
export const FAILURE_BACKOFF_MS = 5 * 60 * 1000;

export interface EconomicSnapshot {
  /** ok: tudo recente · cache: exibindo dado guardado (fonte fora do ar ou incompleta) · indisponivel: nada guardado. */
  status: "ok" | "cache" | "indisponivel";
  /** Quando o dado exibido mais antigo foi consultado na fonte (ISO). */
  updatedAt: string | null;
  indicators: IndicatorView[];
  realRate: RealRateView | null;
}

export interface SnapshotDeps {
  fetchAll?: FetchAll;
  store?: EconomicStore;
  now?: () => Date;
}

export const UNAVAILABLE_SNAPSHOT: EconomicSnapshot = { status: "indisponivel", updatedAt: null, indicators: [], realRate: null };

export function createSnapshotService(deps: SnapshotDeps = {}) {
  const fetchAll = deps.fetchAll ?? fetchAllIndicators;
  const now = deps.now ?? (() => new Date());
  let inflight: Promise<EconomicSnapshot> | null = null;
  let lastFailureAt = Number.NEGATIVE_INFINITY;

  async function load(): Promise<EconomicSnapshot> {
    const store = deps.store ?? getDefaultStore();
    const at = now();
    let stored: StoredData = await store.loadIndicators();

    const isFresh = (id: (typeof INDICATOR_IDS)[number]) => {
      const item = stored[id];
      return !!item && at.getTime() - Date.parse(item.fetchedAt) < SNAPSHOT_TTL_MS;
    };

    if (!INDICATOR_IDS.every(isFresh) && at.getTime() - lastFailureAt >= FAILURE_BACKOFF_MS) {
      try {
        const { data, failed } = await fetchAll(at);
        const fresh: StoredData = {};
        for (const id of INDICATOR_IDS) {
          const points = data[id];
          if (points && points.length > 0) fresh[id] = { points, fetchedAt: at.toISOString() };
        }
        if (Object.keys(fresh).length > 0) {
          stored = { ...stored, ...fresh };
          await store.saveIndicators(fresh).catch((err) => console.warn("[Economia] não foi possível guardar os dados", err));
        }
        if (failed.length > 0) lastFailureAt = at.getTime();
      } catch (err) {
        lastFailureAt = at.getTime();
        console.warn("[Economia] fonte de dados indisponível; usando o último dado guardado", err instanceof Error ? err.message : err);
      }
    }

    const fetchedAts = INDICATOR_IDS.map((id) => stored[id]?.fetchedAt).filter((v): v is string => !!v);
    if (fetchedAts.length === 0) return UNAVAILABLE_SNAPSHOT;

    const indicators = buildIndicatorViews(stored, at);
    return {
      status: INDICATOR_IDS.every(isFresh) ? "ok" : "cache",
      updatedAt: fetchedAts.sort()[0],
      indicators,
      realRate: buildRealRate(indicators),
    };
  }

  return {
    /** Nunca lança: na pior hipótese devolve o snapshot "indisponivel". Chamadas simultâneas dividem a mesma busca. */
    async get(): Promise<EconomicSnapshot> {
      inflight ??= load()
        .catch((err) => {
          console.error("[Economia] erro inesperado ao montar o painel", err);
          return UNAVAILABLE_SNAPSHOT;
        })
        .finally(() => {
          inflight = null;
        });
      return inflight;
    },
  };
}

let defaultService: ReturnType<typeof createSnapshotService> | null = null;

export function getEconomicSnapshot(): Promise<EconomicSnapshot> {
  defaultService ??= createSnapshotService();
  return defaultService.get();
}
