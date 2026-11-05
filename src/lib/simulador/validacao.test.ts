import { test } from "node:test";
import assert from "node:assert/strict";
import { validateInput } from "./validacao.ts";

const ok = (body: unknown) => {
  const r = validateInput(body);
  assert.equal(r.ok, true, JSON.stringify(r));
  return r.ok ? r.value : null!;
};
const fail = (body: unknown) => {
  const r = validateInput(body);
  assert.equal(r.ok, false);
  return r.ok ? null! : r;
};

test("entradas válidas", () => {
  assert.deepEqual(ok({ initial: 10_000, monthly: 500, years: 10 }), { initial: 10_000, monthly: 500, years: 10, goal: null });
  assert.deepEqual(ok({ initial: 0, monthly: 500, years: 0.5, goal: 100_000 }), { initial: 0, monthly: 500, years: 0.5, goal: 100_000 });
  assert.deepEqual(ok({ initial: "1000.50", monthly: "0", years: "7.5", goal: "" }), { initial: 1000.5, monthly: 0, years: 7.5, goal: null });
});

test("aporte inicial zero com mensal positivo e o contrário são aceitos", () => {
  ok({ initial: 0, monthly: 1, years: 1 });
  ok({ initial: 1, monthly: 0, years: 1 });
});

test("ao menos um dos valores precisa ser maior que zero", () => {
  const r = fail({ initial: 0, monthly: 0, years: 5 });
  assert.match(r.error, /maior que zero/);
  assert.ok(r.fields.initial);
});

test("valores negativos são recusados", () => {
  assert.match(fail({ initial: -1, monthly: 0, years: 5 }).fields.initial!, /negativo/);
  assert.match(fail({ initial: 0, monthly: -5, years: 5 }).fields.monthly!, /negativo/);
});

test("valores acima do limite são recusados com o limite na mensagem", () => {
  assert.match(fail({ initial: 10_000_001, monthly: 0, years: 5 }).fields.initial!, /10\.000\.000,00/);
  assert.match(fail({ initial: 0, monthly: 1_000_001, years: 5 }).fields.monthly!, /1\.000\.000,00/);
  assert.match(fail({ initial: 1, monthly: 0, years: 5, goal: 2_000_000_000 }).fields.goal!, /1\.000\.000\.000,00/);
});

test("prazo: mínimo, máximo, passo e formato", () => {
  assert.match(fail({ initial: 1, monthly: 0, years: 0.25 }).fields.years!, /entre 0,5 e 50/);
  assert.match(fail({ initial: 1, monthly: 0, years: 51 }).fields.years!, /entre 0,5 e 50/);
  assert.match(fail({ initial: 1, monthly: 0, years: 3.3 }).fields.years!, /múltiplos/);
  assert.match(fail({ initial: 1, monthly: 0 }).fields.years!, /Informe o prazo/);
  assert.match(fail({ initial: 1, monthly: 0, years: "abc" }).fields.years!, /número/);
  ok({ initial: 1, monthly: 0, years: 50 });
  ok({ initial: 1, monthly: 0, years: 0.5 });
});

test("valores ausentes ou não numéricos geram mensagem clara", () => {
  assert.match(fail({ monthly: 0, years: 5 }).fields.initial!, /Informe/);
  assert.match(fail({ initial: "abc", monthly: 0, years: 5 }).fields.initial!, /número/);
  assert.match(fail({ initial: Number.NaN, monthly: 0, years: 5 }).fields.initial!, /número/);
  assert.match(fail({ initial: Infinity, monthly: 0, years: 5 }).fields.initial!, /número|máximo/);
  assert.equal(fail(null).ok, false);
});

test("meta: opcional, mas se vier precisa ser positiva", () => {
  assert.match(fail({ initial: 1, monthly: 0, years: 1, goal: 0 }).fields.goal!, /maior que zero/);
  assert.match(fail({ initial: 1, monthly: 0, years: 1, goal: -5 }).fields.goal!, /maior que zero/);
  assert.equal(ok({ initial: 1, monthly: 0, years: 1, goal: null }).goal, null);
});
