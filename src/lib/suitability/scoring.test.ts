import { test } from "node:test";
import assert from "node:assert/strict";
import { QUESTIONS, type OptionKey } from "./questions.ts";
import { calculateScore, classifyProfile, evaluate, isComplete, MAX_SCORE, MIN_SCORE, type Answers } from "./scoring.ts";

const all = (k: OptionKey): Answers => Object.fromEntries(QUESTIONS.map((q) => [q.id, k]));

test("questionário tem 18 questões com 4 alternativas cada", () => {
  assert.equal(QUESTIONS.length, 18);
  QUESTIONS.forEach((q, i) => {
    assert.equal(q.id, i + 1);
    assert.deepEqual(Object.keys(q.options), ["A", "B", "C", "D"]);
  });
});

test("pontuação mínima e máxima conforme o documento (18 e 72)", () => {
  assert.equal(MIN_SCORE, 18);
  assert.equal(MAX_SCORE, 72);
  assert.equal(calculateScore(all("A")), 18);
  assert.equal(calculateScore(all("D")), 72);
});

test("limites das faixas de perfil", () => {
  assert.equal(classifyProfile(18), "Conservador");
  assert.equal(classifyProfile(32), "Conservador");
  assert.equal(classifyProfile(33), "Moderado");
  assert.equal(classifyProfile(50), "Moderado");
  assert.equal(classifyProfile(51), "Arrojado");
  assert.equal(classifyProfile(62), "Arrojado");
  assert.equal(classifyProfile(63), "Agressivo");
  assert.equal(classifyProfile(72), "Agressivo");
});

test("pontuação fora do intervalo lança erro", () => {
  assert.throws(() => classifyProfile(17));
  assert.throws(() => classifyProfile(73));
});

test("respostas todas B = 36 pontos = Moderado; todas C = 54 = Arrojado", () => {
  assert.deepEqual(evaluate(all("B")), { score: 36, profile: "Moderado" });
  assert.deepEqual(evaluate(all("C")), { score: 54, profile: "Arrojado" });
});

test("resposta ausente é rejeitada", () => {
  const a = all("B") as Partial<Answers>;
  delete a[7];
  assert.equal(isComplete(a), false);
  assert.throws(() => calculateScore(a as Answers));
});
