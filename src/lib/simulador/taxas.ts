/**
 * CDI e inflação atuais para a simulação. Reaproveita o snapshot do Painel Econômico (mesma fonte e mesmo
 * armazenamento); não consulta nada por conta própria.
 * Ordem: dado recente do painel → último dado guardado → valores de referência fixos do sistema.
 */
import { getEconomicSnapshot, type EconomicSnapshot } from "../economia/snapshot.ts";
import type { BaseRates } from "./projecao.ts";
import { REFERENCE_RATES } from "./premissas.ts";

export interface SimRates extends BaseRates {
  /**
   * painel: dados recentes · cache: último dado guardado (fonte fora do ar ou dado antigo) ·
   * referencia: pelo menos um dos dois vem dos valores fixos do sistema (aproximados).
   */
  origem: "painel" | "cache" | "referencia";
  /** Quando o dado do painel foi consultado na fonte (ISO); null se não há dado guardado. */
  atualizadoEm: string | null;
  /** Data de referência de cada valor (ISO), quando vem do painel. */
  cdiDate: string | null;
  ipcaDate: string | null;
  /** Qual dos dois vem dos valores de referência. */
  referencia: { cdi: boolean; ipca12m: boolean };
}

export const REFERENCE_SIM_RATES: SimRates = {
  cdi: REFERENCE_RATES.cdi,
  ipca12m: REFERENCE_RATES.ipca12m,
  origem: "referencia",
  atualizadoEm: null,
  cdiDate: null,
  ipcaDate: null,
  referencia: { cdi: true, ipca12m: true },
};

export function ratesFromSnapshot(snapshot: EconomicSnapshot): SimRates {
  const cdi = snapshot.indicators.find((i) => i.id === "cdi");
  const ipca = snapshot.indicators.find((i) => i.id === "ipca");
  const cdiOk = !!cdi && cdi.value !== null && cdi.value > 0;
  const ipcaOk = !!ipca && ipca.value !== null && Number.isFinite(ipca.value);

  const refCdi = !cdiOk;
  const refIpca = !ipcaOk;
  const anyRef = refCdi || refIpca;
  const old = snapshot.status !== "ok" || !!cdi?.stale || !!ipca?.stale;

  return {
    cdi: cdiOk ? cdi!.value! : REFERENCE_RATES.cdi,
    ipca12m: ipcaOk ? ipca!.value! : REFERENCE_RATES.ipca12m,
    origem: anyRef ? "referencia" : old ? "cache" : "painel",
    atualizadoEm: snapshot.updatedAt,
    cdiDate: cdiOk ? cdi!.date : null,
    ipcaDate: ipcaOk ? ipca!.date : null,
    referencia: { cdi: refCdi, ipca12m: refIpca },
  };
}

export interface RatesDeps {
  snapshot?: () => Promise<EconomicSnapshot>;
}

/** Nunca lança: qualquer problema com a fonte vira dado guardado ou valores de referência. */
export async function getSimRates(deps: RatesDeps = {}): Promise<SimRates> {
  try {
    return ratesFromSnapshot(await (deps.snapshot ?? getEconomicSnapshot)());
  } catch (err) {
    console.warn("[Simulador] não foi possível ler os indicadores; usando valores de referência", err instanceof Error ? err.message : err);
    return REFERENCE_SIM_RATES;
  }
}
