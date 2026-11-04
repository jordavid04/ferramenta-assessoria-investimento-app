/**
 * Armazenamento do cache do painel: Postgres quando disponível, memória do processo como reserva.
 * Falha de cache nunca propaga para quem usa: o painel continua com o que tiver em memória.
 */
import * as db from "../db.ts";
import type { EconomicInsight } from "./content-guard.ts";
import { INDICATOR_IDS, type IndicatorId, type Point } from "./indicators.ts";
import type { StoredData } from "./view.ts";

export interface StoredInsight {
  insight: EconomicInsight;
  createdAt: string;
}

export interface EconomicStore {
  loadIndicators(): Promise<StoredData>;
  /** Grava só os indicadores presentes em `data`. */
  saveIndicators(data: StoredData): Promise<void>;
  loadInsight(key: string): Promise<StoredInsight | null>;
  saveInsight(key: string, insight: EconomicInsight): Promise<void>;
}

/** Operações de banco usadas pelo cache (injetáveis nos testes). */
export interface DbOps {
  listEconomicIndicatorRows: typeof db.listEconomicIndicatorRows;
  saveEconomicIndicatorRow: typeof db.saveEconomicIndicatorRow;
  getEconomicInsightRow: typeof db.getEconomicInsightRow;
  saveEconomicInsightRow: typeof db.saveEconomicInsightRow;
}

const DB_TIMEOUT_MS = 3_000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Banco demorou demais para responder")), DB_TIMEOUT_MS);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

function warnDb(err: unknown): void {
  if (err instanceof Error && err.name === "DatabaseDisabledError") return; // sem banco configurado: esperado
  console.warn("[Economia] cache em banco indisponível; usando memória", err instanceof Error ? err.message : err);
}

function sanitizePoints(raw: unknown): Point[] | null {
  if (!Array.isArray(raw)) return null;
  const ok = raw.every(
    (p) => typeof p === "object" && p !== null && typeof (p as Point).date === "string" && Number.isFinite((p as Point).value),
  );
  return ok && raw.length > 0 ? (raw as Point[]) : null;
}

export function createMemoryStore(now: () => Date = () => new Date()): EconomicStore {
  let indicators: StoredData = {};
  const insights = new Map<string, StoredInsight>();
  return {
    async loadIndicators() {
      return { ...indicators };
    },
    async saveIndicators(data) {
      indicators = { ...indicators, ...data };
    },
    async loadInsight(key) {
      return insights.get(key) ?? null;
    },
    async saveInsight(key, insight) {
      insights.set(key, { insight, createdAt: now().toISOString() });
    },
  };
}

export function createHybridStore(dbOps: DbOps = db, memory: EconomicStore = createMemoryStore()): EconomicStore {
  return {
    async loadIndicators() {
      const mem = await memory.loadIndicators();
      try {
        const rows = await withTimeout(dbOps.listEconomicIndicatorRows());
        const merged: StoredData = { ...mem };
        for (const row of rows) {
          const id = row.indicator as IndicatorId;
          const points = sanitizePoints(row.points);
          if (!INDICATOR_IDS.includes(id) || !points) continue;
          const current = merged[id];
          if (!current || row.fetchedAt > current.fetchedAt) merged[id] = { points, fetchedAt: row.fetchedAt };
        }
        return merged;
      } catch (err) {
        warnDb(err);
        return mem;
      }
    },
    async saveIndicators(data) {
      await memory.saveIndicators(data);
      try {
        for (const id of INDICATOR_IDS) {
          const item = data[id];
          if (item) await withTimeout(dbOps.saveEconomicIndicatorRow(id, item.points, item.fetchedAt));
        }
      } catch (err) {
        warnDb(err);
      }
    },
    async loadInsight(key) {
      const mem = await memory.loadInsight(key);
      if (mem) return mem;
      try {
        const row = await withTimeout(dbOps.getEconomicInsightRow(key));
        const payload = row?.payload as EconomicInsight | undefined;
        if (!row || !payload || typeof payload.reading !== "string" || !Array.isArray(payload.classNotes)) return null;
        return { insight: payload, createdAt: row.createdAt };
      } catch (err) {
        warnDb(err);
        return null;
      }
    },
    async saveInsight(key, insight) {
      await memory.saveInsight(key, insight);
      try {
        await withTimeout(dbOps.saveEconomicInsightRow(key, insight));
      } catch (err) {
        warnDb(err);
      }
    },
  };
}

let defaultStore: EconomicStore | null = null;

/** Store compartilhado pelo processo (criado sob demanda, para os testes não abrirem conexão). */
export function getDefaultStore(): EconomicStore {
  defaultStore ??= createHybridStore();
  return defaultStore;
}
