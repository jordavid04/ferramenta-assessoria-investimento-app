import { test } from "node:test";
import assert from "node:assert/strict";
import { QUESTIONS } from "../suitability/questions.ts";
import { evaluate } from "../suitability/scoring.ts";
import { analisar, calcularNotas, lerRespostas, notaDaDimensao } from "./calculo.ts";
import { EXEMPLOS, montarRespostas } from "./exemplos.ts";
import { DIMENSION_ORDER, MAPEAMENTOS } from "./mapeamento.ts";

const m = MAPEAMENTOS[0];

function analise(respostas = montarRespostas("C")) {
  const { score, profile } = evaluate(respostas);
  return analisar({ respostas, perfil: profile, pontuacao: score, mapeamento: m });
}

test("tudo A, B, C ou D dá a mesma nota em todas as dimensões", () => {
  for (const [letra, esperado] of [["A", 0], ["B", 33], ["C", 67], ["D", 100]] as const) {
    const notas = calcularNotas(montarRespostas(letra), m);
    for (const d of DIMENSION_ORDER) assert.equal(notas[d], esperado, `${d} tudo ${letra}`);
  }
});

test("vetor conhecido: nota por dimensão com arredondamento", () => {
  // tolerância: B B C... = (10:B 11:C 13:B 14:B 16:B 17:B 18:B) soma 15, n = 7 => (15-7)/21 = 38,1 => 38
  const r = montarRespostas("B", { 11: "C", 5: "A", 12: "A" });
  const notas = calcularNotas(r, m);
  assert.equal(notas.tolerancia, 38);
  assert.equal(notas.objetivo, 0);
  assert.equal(notas.horizonte, 33);
  assert.equal(notas.conhecimento, 33);
  assert.equal(notas.situacao, 33);
});

test("conhecimento e situação têm 13 degraus; objetivo, 7; horizonte, 4", () => {
  const degraus = (d: (typeof DIMENSION_ORDER)[number]) => {
    const vistos = new Set<number>();
    const perguntas = m.perguntas[d];
    const total = 4 ** perguntas.length;
    for (let i = 0; i < total; i++) {
      let resto = i;
      const r = montarRespostas("A");
      for (const id of perguntas) {
        r[id] = (["A", "B", "C", "D"] as const)[resto % 4];
        resto = Math.floor(resto / 4);
      }
      vistos.add(notaDaDimensao(perguntas, r));
    }
    return vistos.size;
  };
  assert.equal(degraus("horizonte"), 4);
  assert.equal(degraus("objetivo"), 7);
  assert.equal(degraus("conhecimento"), 13);
  assert.equal(degraus("situacao"), 13);
});

test("cada pergunta conta só na própria dimensão", () => {
  // mudar apenas a Q6 mexe só no horizonte
  const base = calcularNotas(montarRespostas("B"), m);
  const mudou = calcularNotas(montarRespostas("B", { 6: "D" }), m);
  for (const d of DIMENSION_ORDER) {
    if (d === "horizonte") assert.notEqual(mudou[d], base[d]);
    else assert.equal(mudou[d], base[d], d);
  }
  // mudar a Q12 mexe só no objetivo (e não na tolerância, onde ela ficava no formulário)
  const q12 = calcularNotas(montarRespostas("B", { 12: "D" }), m);
  assert.notEqual(q12.objetivo, base.objetivo);
  assert.equal(q12.tolerancia, base.tolerancia);
});

test("resposta ausente ou inválida lança erro no cálculo de uma dimensão", () => {
  const r = montarRespostas("B") as Record<number, string | undefined>;
  delete r[6];
  assert.throws(() => notaDaDimensao([6], r as never), /questão 6/);
  r[6] = "Z";
  assert.throws(() => notaDaDimensao([6], r as never), /questão 6/);
  assert.throws(() => notaDaDimensao([], montarRespostas("A")), /sem perguntas/);
});

test("lerRespostas aceita o formato guardado no banco", () => {
  const guardado = Object.fromEntries(QUESTIONS.map((q) => [String(q.id), "C"]));
  const lidas = lerRespostas(guardado, m);
  assert.ok(lidas);
  assert.equal(Object.keys(lidas).length, 18);
  assert.equal(lidas[6], "C");
});

test("lerRespostas devolve null para respostas incompletas ou inválidas", () => {
  const completo = Object.fromEntries(QUESTIONS.map((q) => [String(q.id), "B"]));
  const faltando: Record<string, unknown> = { ...completo };
  delete faltando["7"];
  assert.equal(lerRespostas(faltando, m), null);
  assert.equal(lerRespostas({ ...completo, "3": "E" }, m), null);
  assert.equal(lerRespostas({ ...completo, "3": 2 }, m), null);
  assert.equal(lerRespostas({ ...completo, "3": null }, m), null);
  assert.equal(lerRespostas({}, m), null);
  assert.equal(lerRespostas(null, m), null);
  assert.equal(lerRespostas(undefined, m), null);
  assert.equal(lerRespostas("texto", m), null);
  assert.equal(lerRespostas([], m), null);
  assert.equal(lerRespostas(Object.values(completo), m), null);
});

test("lerRespostas ignora campos extras e devolve só as perguntas do mapeamento", () => {
  const completo = Object.fromEntries(QUESTIONS.map((q) => [String(q.id), "B"]));
  const lidas = lerRespostas({ ...completo, "99": "A", extra: "x" }, m);
  assert.ok(lidas);
  assert.equal(Object.keys(lidas).length, 18);
  assert.equal(lidas[99], undefined);
});

test("analisar devolve as cinco dimensões, na ordem do radar, com nota, faixa e resumo", () => {
  const a = analise();
  assert.deepEqual(a.dimensoes.map((d) => d.id), DIMENSION_ORDER);
  for (const d of a.dimensoes) {
    assert.ok(d.nota >= 0 && d.nota <= 100);
    assert.ok(d.resumo.length > 0 && d.resumo.length <= 160, `${d.id}: ${d.resumo.length} caracteres`);
    assert.equal(d.nota, a.notas[d.id]);
    assert.equal(d.perguntas, m.perguntas[d.id].length);
  }
});

test("o resumo muda com a faixa e o horizonte descreve a resposta escolhida", () => {
  const baixa = analise(montarRespostas("A")).dimensoes.find((d) => d.id === "tolerancia")!;
  const alta = analise(montarRespostas("D")).dimensoes.find((d) => d.id === "tolerancia")!;
  assert.notEqual(baixa.resumo, alta.resumo);
  assert.match(alta.resumo, /alta tolerância/);

  const h = (k: "A" | "B" | "C" | "D") => analise(montarRespostas("C", { 6: k })).dimensoes.find((d) => d.id === "horizonte")!;
  assert.match(h("A").resumo, /menos de 1 ano/);
  assert.match(h("B").resumo, /entre 1 e 3 anos/);
  assert.match(h("C").resumo, /entre 3 e 5 anos/);
  assert.match(h("D").resumo, /mais de 5 anos/);
  assert.equal(h("A").detalhe, "Menos de 1 ano");
});

test("só as dimensões com poucas perguntas trazem a resposta escolhida (detalhe)", () => {
  const a = analise(montarRespostas("C", { 5: "A", 6: "D" }));
  const por = Object.fromEntries(a.dimensoes.map((d) => [d.id, d.detalhe]));
  assert.equal(por.horizonte, "Mais de 5 anos");
  assert.equal(por.objetivo, "Preservar capital");
  assert.equal(por.tolerancia, null);
  assert.equal(por.conhecimento, null);
  assert.equal(por.situacao, null);
});

test("analisar não altera as respostas, o perfil nem a pontuação", () => {
  for (const [nome, ex] of Object.entries(EXEMPLOS)) {
    const antes = evaluate(ex.respostas);
    const copia = structuredClone(ex.respostas);
    const congeladas = Object.freeze({ ...ex.respostas });
    analisar({ respostas: congeladas, perfil: antes.profile, pontuacao: antes.score, mapeamento: m });
    assert.deepEqual(ex.respostas, copia, nome);
    assert.deepEqual(evaluate(ex.respostas), antes, nome);
  }
});

test("a pontuação e o perfil continuam os de sempre (36 = Moderado, 54 = Arrojado)", () => {
  assert.deepEqual(evaluate(montarRespostas("B")), { score: 36, profile: "Moderado" });
  assert.deepEqual(evaluate(montarRespostas("C")), { score: 54, profile: "Arrojado" });
});
