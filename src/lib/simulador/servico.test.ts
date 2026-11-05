import { test } from "node:test";
import assert from "node:assert/strict";
import type { LatestAnalysis } from "../db.ts";
import type { EconomicSnapshot } from "../economia/snapshot.ts";
import type { IndicatorView } from "../economia/view.ts";
import { baseAllocation, normalizeAllocation, resolvePerfil } from "./perfil.ts";
import { REFERENCE_RATES } from "./premissas.ts";
import { prepareSimulation } from "./servico.ts";
import { getSimRates, ratesFromSnapshot } from "./taxas.ts";

const NOW = new Date("2026-11-04T12:00:00Z");

const view = (id: "cdi" | "ipca", value: number | null, stale = false): IndicatorView => ({
  id,
  label: id,
  unit: "% a.a.",
  granularity: "dia",
  value,
  date: value === null ? null : "2026-11-03",
  previousValue: null,
  trend: null,
  comparison: "",
  stale,
  monthly: null,
  history: [],
});

const snap = (status: EconomicSnapshot["status"], cdi: number | null, ipca: number | null, stale = false): EconomicSnapshot => ({
  status,
  updatedAt: status === "indisponivel" ? null : "2026-11-01T10:00:00.000Z",
  indicators: status === "indisponivel" ? [] : [view("cdi", cdi, stale), view("ipca", ipca, stale)],
  realRate: null,
});

const analysis = (profile: LatestAnalysis["profile"], createdAt: string, allocation: unknown = baseAllocation(profile)): LatestAnalysis => ({
  id: "a1",
  createdAt,
  profile,
  allocation,
});

const body = { initial: 10_000, monthly: 500, years: 10 };

/* ------------------------------ Taxas ------------------------------ */

test("dados recentes do painel: origem 'painel'", () => {
  const r = ratesFromSnapshot(snap("ok", 14.25, 4.1));
  assert.deepEqual([r.cdi, r.ipca12m, r.origem], [14.25, 4.1, "painel"]);
  assert.equal(r.atualizadoEm, "2026-11-01T10:00:00.000Z");
});

test("fonte fora do ar com dado guardado: origem 'cache' e data dos dados", () => {
  const r = ratesFromSnapshot(snap("cache", 14.25, 4.1));
  assert.equal(r.origem, "cache");
  assert.equal(r.cdi, 14.25);
  assert.ok(r.atualizadoEm);
});

test("dado antigo (stale) também é tratado como último dado guardado", () => {
  assert.equal(ratesFromSnapshot(snap("ok", 14.25, 4.1, true)).origem, "cache");
});

test("sem nenhum dado: valores de referência fixos, sinalizados como aproximados", () => {
  const r = ratesFromSnapshot(snap("indisponivel", null, null));
  assert.deepEqual([r.cdi, r.ipca12m, r.origem], [REFERENCE_RATES.cdi, REFERENCE_RATES.ipca12m, "referencia"]);
  assert.deepEqual(r.referencia, { cdi: true, ipca12m: true });
  assert.equal(r.atualizadoEm, null);
});

test("só um dos dois indicadores disponível: o outro vem da referência", () => {
  const r = ratesFromSnapshot(snap("cache", 13, null));
  assert.equal(r.cdi, 13);
  assert.equal(r.ipca12m, REFERENCE_RATES.ipca12m);
  assert.deepEqual(r.referencia, { cdi: false, ipca12m: true });
  assert.equal(r.origem, "referencia");
});

test("falha inesperada ao ler o painel: valores de referência, sem lançar", async () => {
  const r = await getSimRates({
    snapshot: async () => {
      throw new Error("explodiu");
    },
  });
  assert.equal(r.origem, "referencia");
});

/* ------------------------------ Perfil ------------------------------ */

test("anônimo sem escolher perfil: pendente", async () => {
  const r = await resolvePerfil(null, undefined);
  assert.deepEqual(r, { estado: "anonimo", pendente: true });
});

test("anônimo com perfil de exemplo: usa a alocação-base", async () => {
  const r = await resolvePerfil(null, "Arrojado");
  assert.ok(!("pendente" in r));
  if ("pendente" in r) return;
  assert.equal(r.origem, "exemplo");
  assert.equal(r.profile, "Arrojado");
  assert.deepEqual(r.allocation, baseAllocation("Arrojado"));
});

test("perfil de exemplo inválido é tratado como não escolhido", async () => {
  assert.deepEqual(await resolvePerfil(null, "Qualquer"), { estado: "anonimo", pendente: true });
});

test("logado sem análise: pede perfil de exemplo e aceita a escolha", async () => {
  const deps = { getLatest: async () => null, now: () => NOW };
  assert.deepEqual(await resolvePerfil("u1", undefined, deps), { estado: "sem-analise", pendente: true });
  const r = await resolvePerfil("u1", "Moderado", deps);
  assert.ok(!("pendente" in r));
  if (!("pendente" in r)) {
    assert.equal(r.estado, "sem-analise");
    assert.equal(r.origem, "exemplo");
  }
});

test("logado com análise: usa o perfil e a alocação GRAVADOS (a que o usuário viu), ignorando o exemplo pedido", async () => {
  const ajustada = [
    { assetClass: "Renda Fixa", percent: 55 },
    { assetClass: "Fundos Imobiliários", percent: 15 },
    { assetClass: "ETFs", percent: 12 },
    { assetClass: "Fundos", percent: 10 },
    { assetClass: "Ações", percent: 8 },
  ];
  const r = await resolvePerfil("u1", "Agressivo", { getLatest: async () => analysis("Moderado", "2026-09-01T00:00:00Z", ajustada), now: () => NOW });
  assert.ok(!("pendente" in r));
  if ("pendente" in r) return;
  assert.equal(r.origem, "analise");
  assert.equal(r.profile, "Moderado");
  assert.equal(r.estado, "com-analise");
  assert.deepEqual(r.allocation, ajustada);
  assert.equal(r.alocacaoBase, false);
});

test("alocação gravada inválida: usa a alocação-base do perfil e sinaliza", async () => {
  const r = await resolvePerfil("u1", undefined, { getLatest: async () => analysis("Arrojado", "2026-09-01T00:00:00Z", [{ assetClass: "Ouro", percent: 100 }]), now: () => NOW });
  assert.ok(!("pendente" in r));
  if ("pendente" in r) return;
  assert.deepEqual(r.allocation, baseAllocation("Arrojado"));
  assert.equal(r.alocacaoBase, true);
});

test("normalizeAllocation recusa soma diferente de 100, classe repetida e valores inválidos", () => {
  const ok = [
    { assetClass: "Renda Fixa", percent: 70 },
    { assetClass: "Ações", percent: 30 },
  ];
  assert.deepEqual(normalizeAllocation(ok), ok);
  assert.equal(normalizeAllocation([{ assetClass: "Renda Fixa", percent: 90 }]), null);
  assert.equal(normalizeAllocation([{ assetClass: "Renda Fixa", percent: 50 }, { assetClass: "Renda Fixa", percent: 50 }]), null);
  assert.equal(normalizeAllocation([{ assetClass: "Renda Fixa", percent: -10 }, { assetClass: "Ações", percent: 110 }]), null);
  assert.equal(normalizeAllocation("x"), null);
  assert.equal(normalizeAllocation([]), null);
});

test("perfil com mais de 12 meses é usado, mas sinalizado como antigo", async () => {
  const r = await resolvePerfil("u1", undefined, { getLatest: async () => analysis("Conservador", "2025-09-01T00:00:00Z"), now: () => NOW });
  assert.ok(!("pendente" in r));
  if (!("pendente" in r)) assert.equal(r.estado, "perfil-antigo");
  const recent = await resolvePerfil("u1", undefined, { getLatest: async () => analysis("Conservador", "2025-11-10T00:00:00Z"), now: () => NOW });
  if (!("pendente" in recent)) assert.equal(recent.estado, "com-analise");
});

test("falha ao ler o histórico não quebra: segue com perfil de exemplo", async () => {
  const deps = {
    getLatest: async () => {
      throw new Error("banco fora do ar");
    },
    now: () => NOW,
  };
  assert.deepEqual(await resolvePerfil("u1", undefined, deps), { estado: "indisponivel", pendente: true });
  const r = await resolvePerfil("u1", "Moderado", deps);
  assert.ok(!("pendente" in r));
  if (!("pendente" in r)) assert.equal(r.estado, "indisponivel");
});

/* ------------------------- Simulação completa ------------------------- */

const deps = (s: EconomicSnapshot, latest: LatestAnalysis | null = null) => ({ snapshot: async () => s, getLatest: async () => latest, now: () => NOW });

test("anônimo escolhe perfil e recebe os três cenários", async () => {
  const r = await prepareSimulation({ ...body, profile: "Moderado" }, null, deps(snap("ok", 14.5, 4.5)));
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.data.perfil.origem, "exemplo");
  assert.deepEqual(Object.keys(r.data.projection.scenarios), ["pessimista", "base", "otimista"]);
  assert.equal(r.data.shortTerm, false);
});

test("a projeção muda ao trocar de perfil", async () => {
  const a = await prepareSimulation({ ...body, profile: "Conservador" }, null, deps(snap("ok", 14.5, 4.5)));
  const b = await prepareSimulation({ ...body, profile: "Agressivo" }, null, deps(snap("ok", 14.5, 4.5)));
  assert.ok(a.ok && b.ok);
  if (a.ok && b.ok) assert.notEqual(a.data.projection.scenarios.base.finalValue, b.data.projection.scenarios.base.finalValue);
});

test("sem perfil: erro claro e needsProfile", async () => {
  const r = await prepareSimulation(body, null, deps(snap("ok", 14.5, 4.5)));
  assert.ok(!r.ok);
  if (r.ok) return;
  assert.equal(r.status, 422);
  assert.equal(r.needsProfile, true);
  assert.match(r.error, /perfil de exemplo/);
});

test("entrada inválida: 422 com a mensagem do campo", async () => {
  const r = await prepareSimulation({ initial: -5, monthly: 1, years: 5, profile: "Moderado" }, null, deps(snap("ok", 14.5, 4.5)));
  assert.ok(!r.ok);
  if (!r.ok) {
    assert.equal(r.status, 422);
    assert.match(r.fields!.initial!, /negativo/);
  }
});

test("prazo menor que 1 ano: simulação marcada como pouco representativa", async () => {
  const r = await prepareSimulation({ initial: 1000, monthly: 0, years: 0.5, profile: "Moderado" }, null, deps(snap("ok", 14.5, 4.5)));
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.data.shortTerm, true);
});

test("fonte fora do ar: a simulação funciona com valores de referência", async () => {
  const r = await prepareSimulation({ ...body, profile: "Moderado" }, null, deps(snap("indisponivel", null, null)));
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.data.rates.origem, "referencia");
    assert.equal(r.data.projection.rates.cdi, REFERENCE_RATES.cdi);
  }
});

test("logado com análise: usa a alocação gravada na projeção", async () => {
  const gravada = [
    { assetClass: "Renda Fixa", percent: 100 },
  ];
  const r = await prepareSimulation(body, "u1", deps(snap("ok", 12, 5), analysis("Conservador", "2026-10-01T00:00:00Z", gravada)));
  assert.ok(r.ok);
  if (!r.ok) return;
  // 100% renda fixa: base = 10.000 e 500/mês a 12% ao ano, conferido pela fórmula fechada
  const m = Math.pow(1.12, 1 / 12) - 1;
  const g = Math.pow(1 + m, 120);
  const esperado = 10_000 * g + (500 * (g - 1)) / m;
  assert.ok(Math.abs(r.data.projection.scenarios.base.finalValue - esperado) < 0.05);
});
