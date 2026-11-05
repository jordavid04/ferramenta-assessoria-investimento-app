import { test } from "node:test";
import assert from "node:assert/strict";
import { PROFILE_MAX_AGE_DAYS } from "../economia/leitura.ts";
import { compararAnalises, dataBR, precisaReavaliar, type AnaliseComNotas } from "./evolucao.ts";
import { LIMITES, type DimensionId } from "./mapeamento.ts";

const notas = (n: Partial<Record<DimensionId, number>>): Record<DimensionId, number> => ({
  tolerancia: 50,
  horizonte: 50,
  conhecimento: 50,
  situacao: 50,
  objetivo: 50,
  ...n,
});

const analise = (over: Partial<AnaliseComNotas> = {}): AnaliseComNotas => ({
  id: "a",
  createdAt: "2026-11-04T12:00:00.000Z",
  pontuacao: 40,
  perfil: "Moderado",
  notas: notas({}),
  ...over,
});

const anterior = (over: Partial<AnaliseComNotas> = {}): AnaliseComNotas => analise({ id: "b", createdAt: "2026-03-12T15:00:00.000Z", ...over });

/* ------------------------------ Evolução ------------------------------ */

test("calcula a variação de cada dimensão em pontos percentuais", () => {
  const ev = compararAnalises(
    analise({ notas: notas({ tolerancia: 67, horizonte: 0, conhecimento: 58 }) }),
    anterior({ notas: notas({ tolerancia: 50, horizonte: 33, conhecimento: 58 }) }),
  );
  const por = Object.fromEntries(ev.variacoes.map((v) => [v.id, v]));
  assert.equal(por.tolerancia.delta, 17);
  assert.equal(por.tolerancia.sentido, "subiu");
  assert.equal(por.horizonte.delta, -33);
  assert.equal(por.horizonte.sentido, "caiu");
  assert.equal(por.conhecimento.delta, 0);
  assert.equal(por.conhecimento.sentido, "estavel");
  assert.equal(ev.variacoes.length, 5);
});

test("mudança menor que o limite conta como estável; no limite conta", () => {
  const ev = compararAnalises(
    analise({ notas: notas({ tolerancia: 50 + LIMITES.variacaoMinima - 1, situacao: 50 + LIMITES.variacaoMinima, objetivo: 50 - LIMITES.variacaoMinima }) }),
    anterior(),
  );
  const por = Object.fromEntries(ev.variacoes.map((v) => [v.id, v.sentido]));
  assert.equal(por.tolerancia, "estavel");
  assert.equal(por.situacao, "subiu");
  assert.equal(por.objetivo, "caiu");
});

test("o resumo diz o que subiu, o que caiu e a data da análise anterior", () => {
  const ev = compararAnalises(
    analise({ notas: notas({ tolerancia: 67, horizonte: 0 }) }),
    anterior({ notas: notas({ tolerancia: 50, horizonte: 33 }) }),
  );
  assert.match(ev.resumo, /12\/03\/2026/);
  assert.match(ev.resumo, /Tolerância a perdas subiu 17 pontos percentuais/);
  assert.match(ev.resumo, /Horizonte de tempo caiu 33 pontos percentuais/);
  assert.match(ev.resumo, /demais dimensões ficaram estáveis/);
  assert.match(ev.resumo, /O perfil continua Moderado/);
});

test("sem mudança relevante, o resumo diz que tudo ficou estável", () => {
  const ev = compararAnalises(analise(), anterior());
  assert.match(ev.resumo, /Nenhuma dimensão mudou de forma relevante/);
  assert.equal(ev.deltaPontuacao, 0);
  assert.equal(ev.mudouPerfil, false);
});

test("mudança de perfil e de pontuação é registrada", () => {
  const ev = compararAnalises(analise({ perfil: "Arrojado", pontuacao: 55 }), anterior({ perfil: "Moderado", pontuacao: 48 }));
  assert.equal(ev.mudouPerfil, true);
  assert.equal(ev.deltaPontuacao, 7);
  assert.match(ev.resumo, /O perfil mudou de Moderado para Arrojado/);
  assert.equal(ev.anterior.perfil, "Moderado");
  assert.equal(ev.anterior.pontuacao, 48);
  assert.equal(ev.anterior.id, "b");
});

test("as notas da análise anterior seguem a ordem do radar, para o gráfico sobreposto", () => {
  const ev = compararAnalises(analise(), anterior({ notas: notas({ tolerancia: 10, horizonte: 20, conhecimento: 30, situacao: 40, objetivo: 60 }) }));
  assert.deepEqual(ev.anterior.notas.map((n) => [n.id, n.nota]), [
    ["tolerancia", 10],
    ["horizonte", 20],
    ["conhecimento", 30],
    ["situacao", 40],
    ["objetivo", 60],
  ]);
});

test("uma variação de um ponto usa o singular", () => {
  // variacaoMinima = 10: só aparece no resumo se for >= 10; o singular vale para qualquer delta de módulo 1
  const ev = compararAnalises(analise({ notas: notas({ tolerancia: 61 }) }), anterior({ notas: notas({ tolerancia: 50 }) }));
  assert.match(ev.resumo, /subiu 11 pontos percentuais/);
});

test("dataBR usa o fuso de Brasília (a virada do dia em UTC não muda a data)", () => {
  assert.equal(dataBR("2026-03-12T02:30:00.000Z"), "11/03/2026");
  assert.equal(dataBR("2026-03-12T15:00:00.000Z"), "12/03/2026");
});

/* ------------------------------ Lembrete ------------------------------ */

const DIA = 86_400_000;
const agora = new Date("2026-11-04T12:00:00.000Z");
const haDias = (n: number) => new Date(agora.getTime() - n * DIA).toISOString();

test("o limite é de 12 meses (365 dias), o mesmo do painel econômico", () => {
  assert.equal(PROFILE_MAX_AGE_DAYS, 365);
});

test("análise recente não pede reavaliação", () => {
  assert.equal(precisaReavaliar(haDias(0), agora), false);
  assert.equal(precisaReavaliar(haDias(30), agora), false);
  assert.equal(precisaReavaliar(haDias(300), agora), false);
});

test("365 dias exatos ainda não pedem; a partir de 366 pedem", () => {
  assert.equal(precisaReavaliar(haDias(365), agora), false);
  assert.equal(precisaReavaliar(haDias(366), agora), true);
  assert.equal(precisaReavaliar(haDias(800), agora), true);
});

test("data inválida não gera aviso", () => {
  assert.equal(precisaReavaliar("não é data", agora), false);
});
