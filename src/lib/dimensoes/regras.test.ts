import { test } from "node:test";
import assert from "node:assert/strict";
import { checkForbiddenLanguage } from "../economia/content-guard.ts";
import { evaluate, type Profile } from "../suitability/scoring.ts";
import { calcularNotas } from "./calculo.ts";
import { EXEMPLOS, montarRespostas } from "./exemplos.ts";
import { LIMITES, MAPEAMENTOS, type DimensionId } from "./mapeamento.ts";
import { MENSAGEM_COERENCIA } from "./resumos.ts";
import { avaliarRegras, REGRAS, type ContextoRegras } from "./regras.ts";

const m = MAPEAMENTOS[0];

/** Roda as regras sobre respostas reais (perfil e pontuação calculados como no sistema). */
function ids(respostas: ContextoRegras["respostas"]): string[] {
  const { score, profile } = evaluate(respostas);
  return avaliarRegras({ notas: calcularNotas(respostas, m), respostas, perfil: profile, pontuacao: score }).map((a) => a.id);
}

/** Contexto sintético, para testar limites das notas sem depender de combinações de respostas. */
function ctx(notas: Partial<Record<DimensionId, number>>, perfil: Profile = "Moderado", respostas = montarRespostas("B", { 5: "B", 6: "C" })): ContextoRegras {
  return {
    notas: { tolerancia: 50, horizonte: 50, conhecimento: 50, situacao: 50, objetivo: 50, ...notas },
    respostas,
    perfil,
    pontuacao: 40,
  };
}
const dispara = (c: ContextoRegras, id: string) => avaliarRegras(c).some((a) => a.id === id);

/* ----------------------- Conjuntos de exemplo (um por alerta) ----------------------- */

test("cada conjunto de exemplo dispara exatamente o alerta esperado", () => {
  for (const [nome, ex] of Object.entries(EXEMPLOS)) {
    assert.deepEqual(ids(ex.respostas), ex.esperado, nome);
  }
});

test("há um exemplo para cada regra e um exemplo coerente", () => {
  for (const r of REGRAS) assert.ok(EXEMPLOS[r.id], `sem exemplo para ${r.id}`);
  assert.deepEqual(EXEMPLOS.coerente.esperado, []);
});

test("respostas coerentes não disparam alerta e a mensagem de coerência existe", () => {
  assert.deepEqual(ids(EXEMPLOS.coerente.respostas), []);
  assert.ok(MENSAGEM_COERENCIA.length > 0);
  assert.doesNotMatch(MENSAGEM_COERENCIA, /inconsist|erro|alerta/i);
});

/* ----------------------------- horizonte-curto-tolerancia-alta ----------------------------- */

test("horizonte curto + tolerância muito alta dispara; prazo de até 3 anos conta", () => {
  assert.ok(dispara(ctx({ tolerancia: 100 }, "Moderado", montarRespostas("C", { 6: "A" })), "horizonte-curto-tolerancia-alta"));
  assert.ok(dispara(ctx({ tolerancia: 100 }, "Moderado", montarRespostas("C", { 6: "B" })), "horizonte-curto-tolerancia-alta"));
});

test("horizonte curto com tolerância moderada, ou tolerância alta com prazo médio/longo, não dispara", () => {
  assert.ok(!dispara(ctx({ tolerancia: LIMITES.muitoAltaDesde - 1 }, "Moderado", montarRespostas("C", { 6: "A" })), "horizonte-curto-tolerancia-alta"));
  assert.ok(dispara(ctx({ tolerancia: LIMITES.muitoAltaDesde }, "Moderado", montarRespostas("C", { 6: "A" })), "horizonte-curto-tolerancia-alta"));
  assert.ok(!dispara(ctx({ tolerancia: 100 }, "Moderado", montarRespostas("C", { 6: "C" })), "horizonte-curto-tolerancia-alta"));
  assert.ok(!dispara(ctx({ tolerancia: 100 }, "Moderado", montarRespostas("C", { 6: "D" })), "horizonte-curto-tolerancia-alta"));
});

/* ----------------------------- pouco-conhecimento-respostas-agressivas ----------------------------- */

test("pouco conhecimento + tolerância muito alta dispara (inclusive no limite de 33%)", () => {
  assert.ok(dispara(ctx({ conhecimento: 0, tolerancia: 100 }), "pouco-conhecimento-respostas-agressivas"));
  assert.ok(dispara(ctx({ conhecimento: LIMITES.baixaAte, tolerancia: LIMITES.muitoAltaDesde }), "pouco-conhecimento-respostas-agressivas"));
});

test("conhecimento acima de 33% ou tolerância abaixo de 75% não dispara", () => {
  assert.ok(!dispara(ctx({ conhecimento: LIMITES.baixaAte + 1, tolerancia: 100 }), "pouco-conhecimento-respostas-agressivas"));
  assert.ok(!dispara(ctx({ conhecimento: 0, tolerancia: LIMITES.muitoAltaDesde - 1 }), "pouco-conhecimento-respostas-agressivas"));
});

/* ----------------------------- capacidade-baixa-perfil-arrojado ----------------------------- */

test("capacidade financeira baixa + perfil Arrojado ou Agressivo dispara", () => {
  assert.ok(dispara(ctx({ situacao: 0 }, "Arrojado"), "capacidade-baixa-perfil-arrojado"));
  assert.ok(dispara(ctx({ situacao: LIMITES.baixaAte }, "Agressivo"), "capacidade-baixa-perfil-arrojado"));
});

test("capacidade baixa com perfil Conservador/Moderado, ou capacidade maior que 33% com perfil de risco, não dispara", () => {
  assert.ok(!dispara(ctx({ situacao: 0 }, "Conservador"), "capacidade-baixa-perfil-arrojado"));
  assert.ok(!dispara(ctx({ situacao: 0 }, "Moderado"), "capacidade-baixa-perfil-arrojado"));
  assert.ok(!dispara(ctx({ situacao: LIMITES.baixaAte + 1 }, "Arrojado"), "capacidade-baixa-perfil-arrojado"));
  assert.ok(!dispara(ctx({ situacao: 100 }, "Agressivo"), "capacidade-baixa-perfil-arrojado"));
});

/* ----------------------------- preservar-aceitando-grandes-perdas ----------------------------- */

test("objetivo de preservar capital + aceitar perda de 15% ou mais de 50% em risco dispara", () => {
  const base = { 5: "A" as const };
  assert.ok(dispara(ctx({}, "Moderado", montarRespostas("B", { ...base, 11: "C" })), "preservar-aceitando-grandes-perdas"));
  assert.ok(dispara(ctx({}, "Moderado", montarRespostas("B", { ...base, 11: "D" })), "preservar-aceitando-grandes-perdas"));
  assert.ok(dispara(ctx({}, "Moderado", montarRespostas("B", { ...base, 14: "D" })), "preservar-aceitando-grandes-perdas"));
});

test("preservar capital com respostas conservadoras, ou outro objetivo com perdas aceitas, não dispara", () => {
  assert.ok(!dispara(ctx({}, "Moderado", montarRespostas("A")), "preservar-aceitando-grandes-perdas"));
  assert.ok(!dispara(ctx({}, "Moderado", montarRespostas("B", { 5: "A", 11: "B", 14: "C" })), "preservar-aceitando-grandes-perdas"));
  assert.ok(!dispara(ctx({}, "Moderado", montarRespostas("B", { 5: "B", 11: "D", 14: "D" })), "preservar-aceitando-grandes-perdas"));
  assert.ok(!dispara(ctx({}, "Moderado", montarRespostas("B", { 5: "C", 11: "D" })), "preservar-aceitando-grandes-perdas"));
});

/* ----------------------------- disparidade-entre-dimensoes ----------------------------- */

test("disparidade de 75 pontos ou mais entre dimensões dispara; 74 não", () => {
  assert.ok(dispara(ctx({ tolerancia: 10, objetivo: 10, horizonte: 10, situacao: 10, conhecimento: 10 + LIMITES.muitoAltaDesde }), "disparidade-entre-dimensoes"));
  assert.ok(!dispara(ctx({ tolerancia: 10, objetivo: 10, horizonte: 10, situacao: 10, conhecimento: 10 + LIMITES.muitoAltaDesde - 1 }), "disparidade-entre-dimensoes"));
});

test("a disparidade não repete uma regra específica que já disparou", () => {
  // notas 100 e 0 (disparidade 100) com horizonte curto e tolerância máxima: só a regra específica aparece
  const c = ctx({ tolerancia: 100, horizonte: 0, conhecimento: 67, situacao: 67, objetivo: 67 }, "Arrojado", montarRespostas("C", { 6: "A" }));
  const alertas = avaliarRegras(c).map((a) => a.id);
  assert.deepEqual(alertas, ["horizonte-curto-tolerancia-alta"]);
});

test("a disparidade aparece quando nenhuma regra específica explica a diferença", () => {
  assert.deepEqual(ids(EXEMPLOS["disparidade-entre-dimensoes"].respostas), ["disparidade-entre-dimensoes"]);
});

/* ----------------------------- respostas-uniformes ----------------------------- */

test("as 18 respostas iguais disparam o aviso de padrão uniforme, em qualquer alternativa", () => {
  for (const letra of ["A", "B", "C", "D"] as const) {
    assert.ok(ids(montarRespostas(letra)).includes("respostas-uniformes"), letra);
  }
});

test("17 respostas iguais e uma diferente não disparam o aviso de padrão uniforme", () => {
  assert.ok(!ids(montarRespostas("A", { 18: "B" })).includes("respostas-uniformes"));
  assert.ok(!ids(montarRespostas("D", { 1: "C" })).includes("respostas-uniformes"));
});

test("todas A ou todas D disparam só o aviso de padrão uniforme", () => {
  assert.deepEqual(ids(montarRespostas("A")), ["respostas-uniformes"]);
  assert.deepEqual(ids(montarRespostas("D")), ["respostas-uniformes"]);
});

/* ----------------------------- Propriedades gerais ----------------------------- */

test("as regras têm id único, nome, texto curto, neutro e sem linguagem proibida", () => {
  assert.equal(new Set(REGRAS.map((r) => r.id)).size, REGRAS.length);
  for (const r of REGRAS) {
    assert.ok(r.nome.length > 0 && r.texto.length > 0 && r.reflexao.length > 0, r.id);
    assert.ok(r.texto.length <= 420, `${r.id}: texto com ${r.texto.length} caracteres`);
    assert.deepEqual(checkForbiddenLanguage(`${r.texto} ${r.reflexao}`), [], r.id);
    assert.doesNotMatch(r.texto, /culpa|mentiu|errad[oa]|irresponsáve|absurd/i, r.id);
    assert.ok(["atencao", "info"].includes(r.severidade));
  }
});

test("os alertas saem na ordem das regras e cada um traz os textos da regra", () => {
  const alertas = avaliarRegras(
    ctx({ tolerancia: 100, conhecimento: 0, situacao: 0 }, "Arrojado", montarRespostas("C", { 6: "A" })),
  );
  assert.deepEqual(alertas.map((a) => a.id), [
    "horizonte-curto-tolerancia-alta",
    "pouco-conhecimento-respostas-agressivas",
    "capacidade-baixa-perfil-arrojado",
  ]);
  for (const a of alertas) {
    const regra = REGRAS.find((r) => r.id === a.id)!;
    assert.equal(a.texto, regra.texto);
    assert.equal(a.nome, regra.nome);
  }
});

test("os alertas são informativos: perfil e pontuação ficam idênticos com e sem alertas", () => {
  for (const [nome, ex] of Object.entries(EXEMPLOS)) {
    const antes = evaluate(ex.respostas);
    ids(ex.respostas);
    assert.deepEqual(evaluate(ex.respostas), antes, nome);
  }
  // perfil esperado de cada exemplo (nada foi alterado em scoring.ts)
  assert.equal(evaluate(EXEMPLOS["capacidade-baixa-perfil-arrojado"].respostas).profile, "Arrojado");
  assert.equal(evaluate(EXEMPLOS.coerente.respostas).profile, "Moderado");
});

test("duas regras específicas podem disparar juntas", () => {
  const c = ctx({ tolerancia: 100, conhecimento: 0, horizonte: 0 }, "Moderado", montarRespostas("C", { 6: "A" }));
  const alertas = avaliarRegras(c).map((a) => a.id);
  assert.ok(alertas.includes("horizonte-curto-tolerancia-alta"));
  assert.ok(alertas.includes("pouco-conhecimento-respostas-agressivas"));
});
