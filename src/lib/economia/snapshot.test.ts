import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchAllIndicators, fetchSeries, seriesUrl } from "./bcb.ts";
import { createSnapshotService, FAILURE_BACKOFF_MS, SNAPSHOT_TTL_MS, type SnapshotDeps } from "./snapshot.ts";
import { createHybridStore, createMemoryStore, type DbOps } from "./store.ts";
import type { FetchAll } from "./bcb.ts";
import type { Point } from "./indicators.ts";

const NOW = new Date("2026-11-04T12:00:00Z");

function monthly(): Point[] {
  return Array.from({ length: 14 }, (_, i) => {
    const idx = 2025 * 12 + 7 + i; // a partir de ago/2025
    return { date: `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}-01`, value: 0.4 };
  });
}

const goodData = {
  selic: [{ date: "2026-10-01", value: 13.75 }, { date: "2026-11-04", value: 13.75 }],
  cdi: [{ date: "2026-10-01", value: 13.65 }, { date: "2026-11-03", value: 13.65 }],
  ipca: monthly(),
  dolar: [{ date: "2026-10-01", value: 5.4 }, { date: "2026-11-04", value: 5.4778 }],
};

function counting(impl: FetchAll) {
  const calls = { n: 0 };
  const fn: FetchAll = async (now) => {
    calls.n++;
    return impl(now);
  };
  return { fn, calls };
}

const ok: FetchAll = async () => ({ data: goodData, failed: [] });
const down: FetchAll = async () => {
  throw new Error("BCB fora do ar");
};

function service(fetchAll: FetchAll, store = createMemoryStore(), now: () => Date = () => NOW) {
  return { svc: createSnapshotService({ fetchAll, store, now } satisfies SnapshotDeps), store };
}

test("busca na fonte, monta os 4 indicadores e o juro real", async () => {
  const { svc } = service(ok);
  const s = await svc.get();
  assert.equal(s.status, "ok");
  assert.deepEqual(s.indicators.map((i) => i.id), ["selic", "cdi", "ipca", "dolar"]);
  assert.ok(s.indicators.every((i) => i.value !== null && i.date !== null && !i.stale));
  assert.ok(s.realRate && s.realRate.value > 8);
  assert.equal(s.updatedAt, NOW.toISOString());
});

test("dado ainda recente: não consulta a fonte de novo", async () => {
  const { fn, calls } = counting(ok);
  const { svc } = service(fn);
  await svc.get();
  await svc.get();
  assert.equal(calls.n, 1);
});

test("chamadas simultâneas dividem a mesma busca", async () => {
  const { fn, calls } = counting(ok);
  const { svc } = service(fn);
  await Promise.all([svc.get(), svc.get(), svc.get()]);
  assert.equal(calls.n, 1);
});

test("fonte fora do ar com dado guardado: mostra o último dado com status 'cache'", async () => {
  const store = createMemoryStore();
  await service(ok, store).svc.get();
  const later = new Date(NOW.getTime() + SNAPSHOT_TTL_MS + 60_000);
  const { svc } = service(down, store, () => later);
  const s = await svc.get();
  assert.equal(s.status, "cache");
  assert.equal(s.updatedAt, NOW.toISOString());
  assert.equal(s.indicators.find((i) => i.id === "selic")!.value, 13.75);
});

test("fonte fora do ar e nada guardado: 'indisponivel', sem lançar erro", async () => {
  const { svc } = service(down);
  const s = await svc.get();
  assert.equal(s.status, "indisponivel");
  assert.deepEqual(s.indicators, []);
  assert.equal(s.realRate, null);
});

test("depois de uma falha, espera antes de tentar a fonte de novo", async () => {
  const { fn, calls } = counting(down);
  let t = NOW;
  const { svc } = service(fn, createMemoryStore(), () => t);
  await svc.get();
  await svc.get();
  assert.equal(calls.n, 1);
  t = new Date(NOW.getTime() + FAILURE_BACKOFF_MS + 1);
  await svc.get();
  assert.equal(calls.n, 2);
});

test("um indicador ausente: os outros aparecem e o ausente é sinalizado", async () => {
  const partial: FetchAll = async () => ({ data: { selic: goodData.selic, cdi: goodData.cdi, ipca: goodData.ipca }, failed: ["dolar"] });
  const { svc } = service(partial);
  const s = await svc.get();
  assert.equal(s.status, "cache");
  const dolar = s.indicators.find((i) => i.id === "dolar")!;
  assert.equal(dolar.value, null);
  assert.equal(dolar.stale, true);
  assert.ok(s.indicators.find((i) => i.id === "selic")!.value !== null);
});

test("indicador com data muito antiga é marcado como antigo", async () => {
  const oldSelic: FetchAll = async () => ({ data: { ...goodData, selic: [{ date: "2026-09-01", value: 13.75 }] }, failed: [] });
  const s = await service(oldSelic).svc.get();
  assert.equal(s.indicators.find((i) => i.id === "selic")!.stale, true);
  assert.equal(s.realRate!.stale, true);
});

test("falha do cache em banco não quebra: cai para a memória", async () => {
  const boom = async () => {
    throw new Error("banco fora do ar");
  };
  const dbOps: DbOps = {
    listEconomicIndicatorRows: boom,
    saveEconomicIndicatorRow: boom,
    getEconomicInsightRow: boom,
    saveEconomicInsightRow: boom,
  };
  const store = createHybridStore(dbOps);
  const { fn, calls } = counting(ok);
  const { svc } = service(fn, store);
  const s = await svc.get();
  assert.equal(s.status, "ok");
  await svc.get();
  assert.equal(calls.n, 1, "o dado ficou em memória");
});

test("cache em banco: dado mais novo do banco vence o de memória", async () => {
  const rows = [{ indicator: "selic", points: [{ date: "2026-11-04", value: 14 }], fetchedAt: NOW.toISOString() }];
  const dbOps: DbOps = {
    listEconomicIndicatorRows: async () => rows,
    saveEconomicIndicatorRow: async () => {},
    getEconomicInsightRow: async () => null,
    saveEconomicInsightRow: async () => {},
  };
  const loaded = await createHybridStore(dbOps).loadIndicators();
  assert.equal(loaded.selic?.points[0].value, 14);
});

/* ------------------------------ BCB ------------------------------ */

function withFetch(impl: typeof fetch, run: () => Promise<void>) {
  const real = globalThis.fetch;
  globalThis.fetch = impl;
  return run().finally(() => {
    globalThis.fetch = real;
  });
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

test("BCB: monta a URL com período e usa a série certa", () => {
  const u = seriesUrl("selic", NOW);
  assert.match(u, /bcdata\.sgs\.432\/dados\?/);
  assert.match(u, /formato=json/);
  assert.match(u, /dataInicial=04%2F11%2F2021/);
  assert.match(u, /dataFinal=04%2F11%2F2026/);
  assert.match(seriesUrl("ipca", NOW), /dataInicial=04%2F11%2F2020/);
});

test("BCB: resposta válida vira série", async () => {
  await withFetch((async () => json([{ data: "04/11/2026", valor: "13.75" }])) as typeof fetch, async () => {
    assert.deepEqual(await fetchSeries("selic", NOW), [{ date: "2026-11-04", value: 13.75 }]);
  });
});

test("BCB: erro HTTP, JSON inválido, formato inesperado e rede/timeout viram erro", async () => {
  await withFetch((async () => json({ error: "x" }, 503)) as typeof fetch, async () => {
    await assert.rejects(fetchSeries("selic", NOW), /HTTP 503/);
  });
  await withFetch((async () => new Response("<html>", { status: 200 })) as typeof fetch, async () => {
    await assert.rejects(fetchSeries("selic", NOW), /não é JSON/);
  });
  await withFetch((async () => json({ erro: "limite" })) as typeof fetch, async () => {
    await assert.rejects(fetchSeries("selic", NOW), /fora do formato/);
  });
  await withFetch((async () => {
    throw new TypeError("fetch failed");
  }) as typeof fetch, async () => {
    await assert.rejects(fetchSeries("selic", NOW), /fetch failed/);
  });
});

test("BCB: falha de uma série não derruba as outras", async () => {
  await withFetch((async (url: string | URL | Request) => {
    if (String(url).includes("sgs.1/")) return json({ error: "x" }, 500);
    return json([{ data: "04/11/2026", valor: "1.5" }]);
  }) as typeof fetch, async () => {
    const { data, failed } = await fetchAllIndicators(NOW);
    assert.deepEqual(failed, ["dolar"]);
    assert.ok(data.selic && data.cdi && data.ipca && !data.dolar);
  });
});
