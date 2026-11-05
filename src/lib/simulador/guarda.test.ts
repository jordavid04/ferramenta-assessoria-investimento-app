import { test } from "node:test";
import assert from "node:assert/strict";
import { fmtBRL } from "../economia/format.ts";
import { checkSimText, type GuardInput } from "./guarda.ts";
import { baseAllocation } from "./perfil.ts";
import { project } from "./projecao.ts";

const allocation = baseAllocation("Moderado");
const projection = project({ initial: 10_000, monthly: 500, years: 10, goal: 100_000 }, allocation, { cdi: 14.5, ipca12m: 4.5 });
const g: GuardInput = { projection, allocation, profile: "Moderado" };
const base = projection.scenarios.base;

const reasons = (text: string) => checkSimText(text, g);

test("texto condicional com os números calculados é aceito", () => {
  const text = `Para o perfil Moderado, no cenário base o valor hipotético seria de ${fmtBRL(base.finalValue)} em 10 anos, com ${fmtBRL(projection.invested)} investidos do seu bolso. Em poder de compra de hoje, seria ${fmtBRL(base.realValue)}. A classe Renda Fixa tem 60% da alocação e acompanha o CDI de 14,50%.`;
  assert.deepEqual(reasons(text), []);
});

test("valores em R$ são lidos no formato pt-BR (milhar e decimal)", () => {
  assert.deepEqual(reasons(`O valor hipotético seria ${fmtBRL(base.finalValue)}.`), []);
  // arredondado para reais inteiros também é aceito
  assert.deepEqual(reasons(`O valor hipotético seria R$ ${Math.round(base.finalValue).toLocaleString("pt-BR")}.`), []);
  // outro valor é reprovado, e não confundido com "1.234"
  assert.match(reasons("O valor hipotético seria R$ 1.234,56.").join(), /valor em R\$/);
});

test("abreviações 'mil' e 'milhão' só valem quando batem exatamente", () => {
  assert.deepEqual(reasons("A meta de R$ 100 mil seria atingida."), []);
  assert.match(reasons("O valor seria R$ 1,2 milhão.").join(), /valor em R\$/);
});

test("promessa ou certeza de ganho é reprovada", () => {
  for (const t of [
    "Você vai ter muito dinheiro.",
    "Você terá um patrimônio maior.",
    "O resultado é garantido.",
    "Isso é sem risco.",
    "Com certeza o valor sobe.",
    "O dinheiro vai render bastante.",
    "O rendimento será de 12% ao ano.",
    "Você vai chegar lá.",
  ]) {
    assert.ok(reasons(t).length > 0, t);
  }
});

test("linguagem de recomendação e compra/venda é reprovada", () => {
  for (const t of ["Compre ações.", "Recomendo aumentar o aporte.", "Você deve investir mais.", "É hora de comprar.", "Venda tudo."]) {
    assert.ok(reasons(t).length > 0, t);
  }
});

test("ativos específicos (tickers) são reprovados", () => {
  assert.match(reasons("Considere PETR4 e HGLG11.").join(), /ativo específico/);
});

test("markup e links são reprovados", () => {
  assert.ok(reasons("**negrito** no texto").length > 0);
  assert.ok(reasons("veja https://exemplo.com").length > 0);
});

test("número diferente do calculado é reprovado (percentual e prazo)", () => {
  assert.match(reasons("A renda fixa teria 77% da alocação.").join(), /percentual/);
  assert.match(reasons("Em 25 anos o valor seria maior.").join(), /prazo/);
  assert.match(reasons("Em 9 anos o valor seria maior.").join(), /prazo/);
  assert.deepEqual(reasons("Em 10 anos, com o IPCA acumulado em 12 meses de 4,50%, o valor seria hipotético."), []);
});

test("menção a outro perfil é reprovada", () => {
  assert.match(reasons("Para o perfil Agressivo, o valor seria maior.").join(), /perfil diferente/);
  assert.deepEqual(reasons("Para o perfil Moderado, o valor seria hipotético."), []);
});

test("texto vazio ou longo demais é reprovado", () => {
  assert.deepEqual(reasons("   "), ["texto vazio"]);
  assert.match(reasons("a".repeat(1600)).join(), /longo demais/);
});

test("taxas de cada cenário podem ser citadas", () => {
  const rate = projection.scenarios.pessimista.classRates["Ações"]; // negativa
  const txt = `No cenário pessimista, ações teriam ${rate.toFixed(2).replace(".", ",")}% ao ano, hipoteticamente.`;
  assert.deepEqual(reasons(txt), []);
});
