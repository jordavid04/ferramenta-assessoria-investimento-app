import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accumulatedInflation12m,
  downsampleWeekly,
  isStale,
  parseBcbDate,
  parseBcbSeries,
  realRate,
  rollingInflation12m,
  trend,
  type Point,
} from "./indicators.ts";
import { buildIndicatorView, buildRealRate } from "./view.ts";
import { bandsOf, scenarioKey, type ScenarioFacts } from "./scenario.ts";

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

function months(values: number[], startYear = 2025, startMonth = 1): Point[] {
  return values.map((value, i) => {
    const idx = startYear * 12 + (startMonth - 1) + i;
    return { date: `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}-01`, value };
  });
}

test("juro real usa Fisher: ((1+selic)/(1+ipca))-1", () => {
  near(realRate(13.75, 4.5), ((1.1375 / 1.045) - 1) * 100);
  near(realRate(10, 10), 0);
  assert.ok(realRate(4, 6) < 0, "inflação maior que a Selic dá juro real negativo");
  // Fisher difere da subtração simples
  assert.notEqual(Math.round(realRate(13.75, 4.5) * 100), Math.round((13.75 - 4.5) * 100));
});

test("IPCA acumulado em 12 meses é composto, não a soma", () => {
  const monthly = months(Array(12).fill(0.5));
  near(accumulatedInflation12m(monthly)!, (1.005 ** 12 - 1) * 100);
  assert.ok(accumulatedInflation12m(monthly)! > 6);
});

test("IPCA 12 meses usa só os 12 últimos meses", () => {
  const monthly = months([9, 9, ...Array(12).fill(0.4)]);
  near(accumulatedInflation12m(monthly)!, (1.004 ** 12 - 1) * 100);
});

test("menos de 12 meses ou meses faltando: não calcula (null)", () => {
  assert.equal(accumulatedInflation12m(months(Array(11).fill(0.4))), null);
  const withGap = months(Array(13).fill(0.4)).filter((_, i) => i !== 6);
  assert.equal(accumulatedInflation12m(withGap), null);
  assert.deepEqual(rollingInflation12m(withGap), []);
});

test("IPCA 12m rolante gera um ponto por mês a partir do 12º", () => {
  const rolling = rollingInflation12m(months(Array(15).fill(0.3)));
  assert.equal(rolling.length, 4);
  assert.equal(rolling.at(-1)!.date, "2026-03-01");
});

test("trend: variação pequena é estável; senão alta ou queda", () => {
  assert.equal(trend(13.75, 13.75, 0.05), "estavel");
  assert.equal(trend(13.77, 13.75, 0.05), "estavel");
  assert.equal(trend(14.0, 13.75, 0.05), "alta");
  assert.equal(trend(13.5, 13.75, 0.05), "queda");
  assert.equal(trend(13.75, null, 0.05), null);
});

test("trend relativo (dólar): menos de 0,5% é estável", () => {
  assert.equal(trend(5.4935, 5.4778, 0.5, true), "estavel");
  assert.equal(trend(5.6, 5.4, 0.5, true), "alta");
  assert.equal(trend(5.2, 5.4, 0.5, true), "queda");
});

test("isStale compara a data de referência com 'agora'", () => {
  const now = new Date("2026-11-04T12:00:00Z");
  assert.equal(isStale("2026-11-02", 7, now), false);
  assert.equal(isStale("2026-10-20", 7, now), true);
  assert.equal(isStale("2026-09-01", 75, now), false);
  assert.equal(isStale("2026-07-01", 75, now), true);
});

test("parse do BCB: data e valor válidos, ordenação e descarte de itens ruins", () => {
  const pts = parseBcbSeries([
    { data: "03/11/2026", valor: "13.75" },
    { data: "02/11/2026", valor: "13.70" },
    { data: "31/02/2026", valor: "1" },
    { data: "01/11/2026", valor: "" },
    { data: "x", valor: "1" },
  ]);
  assert.deepEqual(pts, [
    { date: "2026-11-02", value: 13.7 },
    { date: "2026-11-03", value: 13.75 },
  ]);
  assert.equal(parseBcbDate("04/11/2026"), "2026-11-04");
  assert.equal(parseBcbDate("2026-11-04"), null);
});

test("parse do BCB rejeita formato inesperado e série sem dados", () => {
  assert.throws(() => parseBcbSeries({ error: "x" }), /fora do formato/);
  assert.throws(() => parseBcbSeries([]), /sem dados/);
  assert.throws(() => parseBcbSeries([{ foo: 1 }]), /sem dados/);
});

test("downsample semanal mantém o último ponto", () => {
  const days: Point[] = [];
  for (let d = 1; d <= 28; d++) days.push({ date: `2026-10-${String(d).padStart(2, "0")}`, value: d });
  const w = downsampleWeekly(days);
  assert.ok(w.length <= 5 && w.length >= 4);
  assert.equal(w.at(-1)!.value, 28);
});

test("cartão: valor, data, variação e dado antigo", () => {
  const now = new Date("2026-11-04T12:00:00Z");
  const pts: Point[] = [
    { date: "2026-09-30", value: 13.5 },
    { date: "2026-11-04", value: 13.75 },
  ];
  const v = buildIndicatorView("selic", { points: pts, fetchedAt: now.toISOString() }, now);
  assert.equal(v.value, 13.75);
  assert.equal(v.date, "2026-11-04");
  assert.equal(v.trend, "alta");
  assert.equal(v.stale, false);

  const old = buildIndicatorView("selic", { points: [{ date: "2026-08-01", value: 13.75 }], fetchedAt: now.toISOString() }, now);
  assert.equal(old.stale, true);

  const missing = buildIndicatorView("dolar", undefined, now);
  assert.equal(missing.value, null);
  assert.equal(missing.stale, true);
});

test("cartão do IPCA mostra o acumulado 12m e o mensal como apoio; juro real só com os dois", () => {
  const now = new Date("2026-11-04T12:00:00Z");
  const ipca = buildIndicatorView("ipca", { points: months(Array(14).fill(0.4), 2025, 8), fetchedAt: now.toISOString() }, now);
  near(ipca.value!, (1.004 ** 12 - 1) * 100);
  assert.equal(ipca.monthly!.value, 0.4);
  assert.equal(ipca.trend, "estavel");
  const selic = buildIndicatorView("selic", { points: [{ date: "2026-11-04", value: 13.75 }], fetchedAt: now.toISOString() }, now);
  const real = buildRealRate([selic, ipca]);
  near(real!.value, realRate(13.75, ipca.value!));
  assert.equal(buildRealRate([selic, buildIndicatorView("ipca", undefined, now)]), null);
});

test("faixas do cenário e chave de cache", () => {
  const f: ScenarioFacts = { selic: 13.75, cdi: 13.65, ipca12m: 5.1, realRate: 8.2, selicTrend: "estavel", ipcaTrend: "alta", dolarTrend: "queda" };
  assert.deepEqual(bandsOf(f), { juro: "alto", inflacao: "alta", juroReal: "alto" });
  assert.deepEqual(bandsOf({ ...f, selic: 7, ipca12m: 2.5, realRate: 1 }), { juro: "baixo", inflacao: "baixa", juroReal: "baixo" });
  assert.notEqual(scenarioKey("Moderado", f), scenarioKey("Conservador", f));
  assert.notEqual(scenarioKey(null, f), scenarioKey(null, { ...f, selic: 13.5 }));
  assert.equal(scenarioKey(null, f), scenarioKey(null, { ...f }));
});
