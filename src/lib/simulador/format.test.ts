import { test } from "node:test";
import assert from "node:assert/strict";
import { fmtMonths, fmtYears, parseDecimalPtBR } from "./format.ts";

test("parseDecimalPtBR entende os formatos que a pessoa digita", () => {
  assert.equal(parseDecimalPtBR("10000"), 10000);
  assert.equal(parseDecimalPtBR("10.000"), 10000);
  assert.equal(parseDecimalPtBR("10.000,50"), 10000.5);
  assert.equal(parseDecimalPtBR("R$ 1.500"), 1500);
  assert.equal(parseDecimalPtBR("R$ 1.234.567,89"), 1234567.89);
  assert.equal(parseDecimalPtBR("7,5"), 7.5);
  assert.equal(parseDecimalPtBR("7.5"), 7.5);
  assert.equal(parseDecimalPtBR("0"), 0);
});

test("parseDecimalPtBR devolve NaN para texto inválido", () => {
  for (const t of ["", "  ", "abc", "1,2,3", "10x", "-5", "1e5"]) assert.ok(Number.isNaN(parseDecimalPtBR(t)), t);
});

test("fmtYears e fmtMonths", () => {
  assert.equal(fmtYears(1), "1 ano");
  assert.equal(fmtYears(10), "10 anos");
  assert.equal(fmtYears(7.5), "7,5 anos");
  assert.equal(fmtMonths(0), "0 meses");
  assert.equal(fmtMonths(1), "1 mês");
  assert.equal(fmtMonths(12), "1 ano");
  assert.equal(fmtMonths(26), "2 anos e 2 meses");
});
