import { test } from "node:test";
import assert from "node:assert/strict";
import { QUESTIONS } from "../suitability/questions.ts";
import { POINTS } from "../suitability/scoring.ts";
import { notaDaDimensao } from "./calculo.ts";
import {
  DIMENSION_INFO,
  DIMENSION_ORDER,
  escolherMapeamento,
  faixaDe,
  LIMITES,
  MAPEAMENTOS,
  perguntasDoMapeamento,
  type Mapeamento,
} from "./mapeamento.ts";
import { montarRespostas } from "./exemplos.ts";

const atual = MAPEAMENTOS[MAPEAMENTOS.length - 1];

test("toda pergunta do questionário pertence a exatamente uma dimensão", () => {
  const todas = perguntasDoMapeamento(atual);
  for (const q of QUESTIONS) {
    const donas = DIMENSION_ORDER.filter((d) => atual.perguntas[d].includes(q.id));
    assert.equal(donas.length, 1, `questão ${q.id} está em ${donas.length} dimensões`);
  }
  assert.equal(todas.length, QUESTIONS.length);
  assert.equal(new Set(todas).size, todas.length, "pergunta repetida entre dimensões");
});

test("o mapeamento só cita perguntas que existem", () => {
  const ids = new Set(QUESTIONS.map((q) => q.id));
  for (const id of perguntasDoMapeamento(atual)) assert.ok(ids.has(id), `questão ${id} não existe`);
});

test("toda dimensão tem nome, significado e ao menos uma pergunta", () => {
  for (const d of DIMENSION_ORDER) {
    assert.ok(DIMENSION_INFO[d].nome.length > 0);
    assert.ok(DIMENSION_INFO[d].significado.length > 0);
    assert.ok(atual.perguntas[d].length >= 1, d);
  }
  assert.equal(DIMENSION_ORDER.length, 5);
});

test("mapeamento adotado (versão 1)", () => {
  assert.equal(atual.versao, 1);
  assert.deepEqual(atual.perguntas, {
    tolerancia: [10, 11, 13, 14, 16, 17, 18],
    horizonte: [6],
    conhecimento: [7, 8, 9, 15],
    situacao: [1, 2, 3, 4],
    objetivo: [5, 12],
  });
});

test("dimensões com poucas perguntas têm uma pergunta de destaque dentro da própria dimensão", () => {
  for (const d of DIMENSION_ORDER) {
    if (atual.perguntas[d].length < 3) {
      const destaque = atual.destaque[d];
      assert.ok(destaque !== undefined, `${d} tem poucas perguntas e nenhum destaque`);
      assert.ok(atual.perguntas[d].includes(destaque), `destaque de ${d} fora da dimensão`);
    }
  }
});

test("a nota de cada dimensão vai de 0% (tudo A) a 100% (tudo D) e nunca sai desse intervalo", () => {
  const opcoes = [1, 2, 3, 4];
  for (const d of DIMENSION_ORDER) {
    const perguntas = atual.perguntas[d];
    assert.equal(notaDaDimensao(perguntas, montarRespostas("A")), 0, `${d} tudo A`);
    assert.equal(notaDaDimensao(perguntas, montarRespostas("D")), 100, `${d} tudo D`);

    // todas as combinações possíveis (no máximo 4^7 = 16384)
    let min = Infinity;
    let max = -Infinity;
    const total = opcoes.length ** perguntas.length;
    for (let i = 0; i < total; i++) {
      let resto = i;
      const respostas = montarRespostas("A");
      for (const id of perguntas) {
        const chave = (["A", "B", "C", "D"] as const)[resto % 4];
        respostas[id] = chave;
        resto = Math.floor(resto / 4);
      }
      const nota = notaDaDimensao(perguntas, respostas);
      min = Math.min(min, nota);
      max = Math.max(max, nota);
      assert.ok(nota >= 0 && nota <= 100, `${d}: nota ${nota} fora de 0-100`);
    }
    assert.equal(min, 0, `${d} mínimo`);
    assert.equal(max, 100, `${d} máximo`);
  }
});

test("a soma dos pontos mínimos e máximos das dimensões bate com a pontuação total (18 a 72)", () => {
  const n = perguntasDoMapeamento(atual).length;
  assert.equal(n * POINTS.A, 18);
  assert.equal(n * POINTS.D, 72);
});

test("faixas: baixa até 33, média de 34 a 66, alta a partir de 67", () => {
  assert.equal(faixaDe(0), "baixa");
  assert.equal(faixaDe(LIMITES.baixaAte), "baixa");
  assert.equal(faixaDe(LIMITES.baixaAte + 1), "media");
  assert.equal(faixaDe(LIMITES.altaDesde - 1), "media");
  assert.equal(faixaDe(LIMITES.altaDesde), "alta");
  assert.equal(faixaDe(100), "alta");
});

test("a faixa bate com a média das respostas (B ou menos = baixa, C ou mais = alta)", () => {
  // n = 7 (tolerância): todas B => 33; todas C => 67
  assert.equal(faixaDe(notaDaDimensao(atual.perguntas.tolerancia, montarRespostas("B"))), "baixa");
  assert.equal(faixaDe(notaDaDimensao(atual.perguntas.tolerancia, montarRespostas("C"))), "alta");
  // n = 1 (horizonte): 0, 33, 67, 100
  const horizonte = (k: "A" | "B" | "C" | "D") => notaDaDimensao(atual.perguntas.horizonte, montarRespostas(k));
  assert.deepEqual(["A", "B", "C", "D"].map((k) => horizonte(k as "A")), [0, 33, 67, 100]);
});

test("a versão do mapeamento é escolhida pela data da análise", () => {
  const v1: Mapeamento = { ...atual, versao: 1, validoDesde: "2026-01-01T00:00:00Z" };
  const v2: Mapeamento = { ...atual, versao: 2, validoDesde: "2026-08-01T00:00:00Z" };
  const lista = [v2, v1]; // fora de ordem de propósito
  assert.equal(escolherMapeamento("2026-03-10T12:00:00Z", lista).versao, 1);
  assert.equal(escolherMapeamento("2026-08-01T00:00:00Z", lista).versao, 2);
  assert.equal(escolherMapeamento("2026-11-04T00:00:00Z", lista).versao, 2);
  // anterior a todas as versões: usa a mais antiga
  assert.equal(escolherMapeamento("2020-01-01T00:00:00Z", lista).versao, 1);
  // data inválida: usa a mais recente
  assert.equal(escolherMapeamento("não é data", lista).versao, 2);
  assert.equal(escolherMapeamento(new Date("2026-09-01T00:00:00Z"), lista).versao, 2);
});

test("com uma só versão, qualquer análise usa o mapeamento 1", () => {
  assert.equal(escolherMapeamento("2026-11-04T00:00:00Z").versao, 1);
  assert.equal(escolherMapeamento("1999-01-01T00:00:00Z").versao, 1);
});
