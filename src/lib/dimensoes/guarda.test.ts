import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate } from "../suitability/scoring.ts";
import { analisar } from "./calculo.ts";
import { EXEMPLOS, montarRespostas } from "./exemplos.ts";
import { checarLeitura, MAX_LEITURA_LENGTH, numerosPermitidos } from "./guarda.ts";
import { MAPEAMENTOS } from "./mapeamento.ts";
import type { EntradaLeitura, Evolucao } from "./tipos.ts";

const m = MAPEAMENTOS[0];

function entrada(respostas = EXEMPLOS.coerente.respostas, evolucao: Evolucao | null = null): EntradaLeitura {
  const { score, profile } = evaluate(respostas);
  const a = analisar({ respostas, perfil: profile, pontuacao: score, mapeamento: m });
  return { perfil: profile, pontuacao: score, dimensoes: a.dimensoes, alertas: a.alertas, evolucao };
}

// coerente: perfil Moderado, 50 pontos, notas [62, 67, 58, 50, 67], sem alertas
const SEM_ALERTA = entrada();
// horizonte curto + tolerância alta: Arrojado, 59 pontos, notas [100, 0, 67, 67, 67], com 1 alerta
const COM_ALERTA = entrada(EXEMPLOS["horizonte-curto-tolerancia-alta"].respostas);

const motivos = (texto: string, e = SEM_ALERTA) => checarLeitura(texto, e);

const evolucao: Evolucao = {
  anterior: { id: "x", createdAt: "2026-03-12T15:00:00.000Z", pontuacao: 44, perfil: "Moderado", notas: [] },
  variacoes: [
    { id: "tolerancia", nome: "Tolerância a perdas", de: 45, para: 62, delta: 17, sentido: "subiu" },
    { id: "horizonte", nome: "Horizonte de tempo", de: 100, para: 67, delta: -33, sentido: "caiu" },
    { id: "conhecimento", nome: "Conhecimento e experiência", de: 58, para: 58, delta: 0, sentido: "estavel" },
    { id: "situacao", nome: "Situação financeira", de: 50, para: 50, delta: 0, sentido: "estavel" },
    { id: "objetivo", nome: "Objetivo", de: 67, para: 67, delta: 0, sentido: "estavel" },
  ],
  mudouPerfil: false,
  deltaPontuacao: 6,
  resumo: "",
};

/* ------------------------------- Aceita ------------------------------- */

test("texto com os números do sistema, sem promessa nem recomendação, é aceito", () => {
  const texto =
    "Seu perfil é Moderado, com 50 de 72 pontos. A tolerância a perdas está em 62%, em nível intermediário, e o horizonte de tempo em 67%. Vale pensar se o prazo e a tolerância a oscilações estão alinhados com o que você espera dos seus objetivos.";
  assert.deepEqual(motivos(texto), []);
});

test("o resumo e o detalhe das dimensões entregues à IA podem ser citados", () => {
  const e = entrada(EXEMPLOS["horizonte-curto-tolerancia-alta"].respostas);
  assert.deepEqual(checarLeitura("Você pretende usar o dinheiro em menos de 1 ano, e isso pesa na leitura do conjunto.", e), []);
  assert.deepEqual(checarLeitura("O sistema notou um prazo de até 3 anos junto de uma alta tolerância.", e), []);
});

test("comentar que as respostas parecem coerentes é aceito quando não há alertas", () => {
  assert.deepEqual(motivos("As suas respostas parecem coerentes entre si, sem pontos de atenção."), []);
  assert.deepEqual(motivos("Não há contradições entre as respostas."), []);
});

test("comentar os alertas é aceito quando eles existem", () => {
  const texto =
    "Há um ponto de atenção: o horizonte curto junto de uma tolerância alta. Isso é só informativo, e vale pensar se o prazo e a tolerância a oscilações estão alinhados.";
  assert.deepEqual(checarLeitura(texto, COM_ALERTA), []);
});

test("variações da evolução fornecidas pelo sistema podem ser citadas", () => {
  const e = { ...SEM_ALERTA, evolucao };
  assert.deepEqual(checarLeitura("Em relação à análise anterior, a tolerância a perdas subiu 17 pontos percentuais e o horizonte de tempo caiu 33 pontos percentuais.", e), []);
  assert.deepEqual(checarLeitura("A pontuação anterior era 44 de 72.", e), []);
  assert.ok(checarLeitura("A tolerância a perdas subiu 19 pontos percentuais.", e).length > 0);
});

/* --------------------------- Linguagem proibida --------------------------- */

test("promessa ou certeza de ganho é reprovada", () => {
  for (const t of [
    "Seu perfil é Moderado e o resultado é garantido.",
    "Isso é sem risco.",
    "Com certeza o patrimônio vai crescer.",
    "Você terá um patrimônio maior.",
    "Você vai ter bons resultados.",
    "O dinheiro vai render bastante.",
    "A carteira rende 15% ao ano.",
  ]) {
    assert.ok(motivos(t).length > 0, t);
  }
});

test("linguagem de recomendação e de compra/venda é reprovada", () => {
  for (const t of ["Compre ações.", "Recomendo revisar o prazo.", "Você deve investir mais.", "É hora de comprar.", "Venda tudo.", "O ideal é aumentar o risco."]) {
    assert.ok(motivos(t).length > 0, t);
  }
});

test("ativos específicos (tickers) e formatação são reprovados", () => {
  assert.match(motivos("Considere PETR4 e HGLG11.").join(), /ativo específico/);
  assert.ok(motivos("**negrito** no texto").length > 0);
  assert.ok(motivos("veja https://exemplo.com").length > 0);
});

/* ------------------------------- Números ------------------------------- */

test("número que o sistema não calculou é reprovado", () => {
  assert.match(motivos("A tolerância a perdas está em 77%.").join(), /número que o sistema não forneceu/);
  assert.match(motivos("Você tem 31 pontos.").join(), /número que o sistema não forneceu/);
  assert.match(motivos("Seu perfil tem 3,5 pontos de risco.").join(), /número que o sistema não forneceu/);
  assert.match(motivos("Em 25 anos o cenário muda.").join(), /número que o sistema não forneceu/);
});

test("os números permitidos incluem notas, pontuação, 72 e os que aparecem nos textos entregues", () => {
  const permitidos = numerosPermitidos(COM_ALERTA);
  for (const d of COM_ALERTA.dimensoes) assert.ok(permitidos.has(d.nota), d.id);
  assert.ok(permitidos.has(COM_ALERTA.pontuacao));
  assert.ok(permitidos.has(72));
  assert.ok(permitidos.has(3), "o alerta fala de 'até 3 anos'");
  assert.ok(!permitidos.has(77));
});

/* ------------------------------ Perfil ------------------------------ */

test("citar um perfil diferente do calculado é reprovado", () => {
  assert.match(motivos("Para o perfil Agressivo, a leitura seria outra.").join(), /perfil diferente/);
  assert.deepEqual(motivos("Para o perfil Moderado, a leitura é esta."), []);
});

test("afirmar que o perfil deveria ser outro é reprovado", () => {
  for (const t of [
    "Suas respostas sugerem que o perfil deveria ser mais conservador.",
    "O seu perfil real é mais cauteloso.",
    "Um perfil mais conservador seria mais adequado.",
    "Talvez você devesse reclassificar o seu perfil.",
    "Vale mudar de perfil.",
    "Na verdade você é um investidor cauteloso.",
    "Seu perfil poderia ser Arrojado.",
  ]) {
    assert.ok(motivos(t).length > 0, t);
  }
});

/* ------------------------------ Alertas ------------------------------ */

test("dizer que não há inconsistência quando o sistema achou alertas é reprovado", () => {
  for (const t of [
    "Não há inconsistências nas suas respostas.",
    "Nenhum alerta apareceu.",
    "Suas respostas estão totalmente coerentes.",
    "Sem contradições entre as dimensões.",
    "As respostas parecem coerentes.",
  ]) {
    assert.match(checarLeitura(t, COM_ALERTA).join(), /não há inconsistências/, t);
  }
});

test("falar de inconsistência ou alerta quando o sistema não achou nenhum é reprovado", () => {
  for (const t of ["Há uma inconsistência entre o prazo e a tolerância.", "Existe um alerta importante.", "Suas respostas se contradizem.", "Notamos uma incoerência."]) {
    assert.ok(motivos(t).length > 0, t);
  }
});

/* --------------------------- Polaridade por dimensão --------------------------- */

test("contradizer a faixa calculada de uma dimensão é reprovado", () => {
  // horizonte de tempo está na faixa baixa (0%) no exemplo com alerta; tolerância na alta (100%)
  assert.match(checarLeitura("O seu horizonte de tempo é longo.", COM_ALERTA).join(), /contradiz a faixa/);
  assert.match(checarLeitura("Sua tolerância a perdas é baixa.", COM_ALERTA).join(), /contradiz a faixa/);
});

test("frases coerentes com a faixa, ou com mais de uma dimensão, não são julgadas", () => {
  assert.deepEqual(checarLeitura("O seu horizonte de tempo é curto.", COM_ALERTA), []);
  assert.deepEqual(checarLeitura("Sua tolerância a perdas é alta.", COM_ALERTA), []);
  // duas dimensões na mesma frase: ambígua, não julgamos
  assert.deepEqual(checarLeitura("Você tem alta tolerância a perdas, mas um horizonte de tempo curto.", COM_ALERTA), []);
  // faixa média não é julgada
  assert.deepEqual(motivos("Sua situação financeira é intermediária."), []);
});

/* ------------------------------ Formato ------------------------------ */

test("texto vazio ou longo demais é reprovado", () => {
  assert.deepEqual(motivos("   "), ["texto vazio"]);
  assert.match(motivos("a".repeat(MAX_LEITURA_LENGTH + 1)).join(), /longo demais/);
});

test("o aviso de várias falhas junta os motivos", () => {
  const r = motivos("Compre PETR4, vai render 90%.");
  assert.ok(r.length >= 3, r.join(" | "));
});

test("o conjunto de exemplo usa respostas diferentes do coerente (sanidade do teste)", () => {
  assert.notDeepEqual(EXEMPLOS.coerente.respostas, montarRespostas("C"));
  assert.equal(SEM_ALERTA.alertas.length, 0);
  assert.equal(COM_ALERTA.alertas.length, 1);
});
