import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLeitura, resolveProfile, type LeituraDeps } from "./leitura.ts";
import { factsFromViews } from "./scenario.ts";
import { localInsight, type InsightOutcome } from "./insight.ts";
import { createSnapshotService } from "./snapshot.ts";
import { createMemoryStore } from "./store.ts";
import type { SessionSummary } from "../db.ts";

const NOW = new Date("2026-11-04T12:00:00Z");

const session = (profile: SessionSummary["profile"], createdAt: string): SessionSummary => ({ id: "1", createdAt, score: 30, profile });

const monthly = Array.from({ length: 14 }, (_, i) => {
  const idx = 2025 * 12 + 7 + i;
  return { date: `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}-01`, value: 0.4 };
});

const snapshotSvc = createSnapshotService({
  now: () => NOW,
  store: createMemoryStore(),
  fetchAll: async () => ({
    data: {
      selic: [{ date: "2026-11-04", value: 13.75 }],
      cdi: [{ date: "2026-11-03", value: 13.65 }],
      ipca: monthly,
      dolar: [{ date: "2026-11-04", value: 5.4778 }],
    },
    failed: [],
  }),
});

const fakeInsight: LeituraDeps["insight"] = async (profile, facts): Promise<InsightOutcome> => ({
  insight: localInsight(profile, facts),
  source: "fallback",
});

const base = { now: () => NOW, snapshot: () => snapshotSvc.get(), insight: fakeInsight };

test("anônimo: leitura geral, sem consultar o histórico", async () => {
  let called = false;
  const out = await buildLeitura(null, { ...base, getLatest: async () => ((called = true), null) });
  assert.equal(out.state, "anonimo");
  assert.equal(out.profile, null);
  assert.equal(called, false);
  assert.ok(out.insight);
});

test("logado sem análise: leitura geral e estado 'sem-analise'", async () => {
  const out = await buildLeitura("u1", { ...base, getLatest: async () => null });
  assert.equal(out.state, "sem-analise");
  assert.equal(out.profile, null);
  assert.ok(out.insight);
});

test("logado com análise recente: leitura do perfil mais recente", async () => {
  const out = await buildLeitura("u1", { ...base, getLatest: async () => session("Arrojado", "2026-08-01T10:00:00.000Z") });
  assert.equal(out.state, "com-perfil");
  assert.equal(out.profile, "Arrojado");
  assert.match(out.insight!.reading, /Arrojado/);
});

test("perfil com mais de 12 meses: continua personalizado e pede para refazer", async () => {
  const out = await buildLeitura("u1", { ...base, getLatest: async () => session("Conservador", "2025-09-01T10:00:00.000Z") });
  assert.equal(out.state, "perfil-antigo");
  assert.equal(out.profile, "Conservador");
  const justUnder = await resolveProfile("u1", { now: () => NOW, getLatest: async () => session("Conservador", "2025-11-10T10:00:00.000Z") });
  assert.equal(justUnder.state, "com-perfil");
});

test("falha ao ler o histórico: leitura geral, sem quebrar", async () => {
  const out = await buildLeitura("u1", {
    ...base,
    getLatest: async () => {
      throw new Error("banco fora do ar");
    },
  });
  assert.equal(out.state, "perfil-indisponivel");
  assert.equal(out.profile, null);
  assert.ok(out.insight);
});

test("sem dados do cenário: não gera leitura (insight null)", async () => {
  const empty = createSnapshotService({
    now: () => NOW,
    store: createMemoryStore(),
    fetchAll: async () => {
      throw new Error("BCB fora do ar");
    },
  });
  let asked = false;
  const out = await buildLeitura("u1", {
    now: () => NOW,
    getLatest: async () => session("Moderado", "2026-10-01T10:00:00.000Z"),
    snapshot: () => empty.get(),
    insight: async (...a) => ((asked = true), fakeInsight!(...a)),
  });
  assert.equal(out.insight, null);
  assert.equal(out.source, null);
  assert.equal(out.profile, "Moderado");
  assert.equal(asked, false);
});

test("a leitura muda conforme o perfil", async () => {
  const snap = await snapshotSvc.get();
  const facts = factsFromViews(snap.indicators, snap.realRate);
  const a = (await fakeInsight!("Conservador", facts)).insight.reading;
  const b = (await fakeInsight!("Agressivo", facts)).insight.reading;
  assert.notEqual(a, b);
});
