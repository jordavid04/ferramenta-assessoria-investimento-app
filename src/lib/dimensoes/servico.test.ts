import { test } from "node:test";
import assert from "node:assert/strict";
import type { SessionSummary, StoredAnalysis } from "../db.ts";
import { QUESTIONS } from "../suitability/questions.ts";
import { evaluate, type Answers, type Profile } from "../suitability/scoring.ts";
import { EXEMPLOS, montarRespostas } from "./exemplos.ts";
import { MAPEAMENTOS, type Mapeamento } from "./mapeamento.ts";
import { montarRelatorio, MSG_CONSULTA, MSG_INCOMPLETA, type ServicoDeps } from "./servico.ts";

const USER = "11111111-1111-4111-8111-111111111111";
const ID_ATUAL = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID_ANTERIOR = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ID_ANTIGA = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const AGORA = new Date("2026-11-04T12:00:00.000Z");
const DIA = 86_400_000;
const haDias = (n: number) => new Date(AGORA.getTime() - n * DIA).toISOString();

const guardado = (id: string, createdAt: string, respostas: Answers | unknown): StoredAnalysis => {
  const ok = respostas as Answers;
  const { score, profile } = evaluate(ok);
  return { id, createdAt, score, profile, answers: respostas };
};
const incompleto = (id: string, createdAt: string): StoredAnalysis => ({ id, createdAt, score: 30, profile: "Conservador" as Profile, answers: { "1": "A" } });
const resumo = (id: string, createdAt: string): SessionSummary => ({ id, createdAt, score: 36, profile: "Moderado" });

/** Dependências falsas: qualquer consulta ao banco não prevista falha o teste. */
function deps(over: ServicoDeps = {}): ServicoDeps {
  return {
    now: () => AGORA,
    getSession: async () => {
      throw new Error("getSession não deveria ser chamado");
    },
    listRecent: async () => {
      throw new Error("listRecent não deveria ser chamado");
    },
    getLatest: async () => {
      throw new Error("getLatest não deveria ser chamado");
    },
    ...over,
  };
}

const respostasJson = (r: Answers) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v]));

/* ------------------------------ Anônimo ------------------------------ */

test("anônimo com respostas: dimensões do resultado atual, sem evolução e sem tocar o banco", async () => {
  const r = await montarRelatorio({ answers: respostasJson(EXEMPLOS.coerente.respostas) }, null, deps());
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  const rel = r.relatorio;
  assert.equal(rel.origem, "atual");
  assert.equal(rel.logado, false);
  assert.equal(rel.evolucao, null);
  assert.equal(rel.motivoSemEvolucao, "anonimo");
  assert.equal(rel.reavaliacao, null);
  assert.equal(rel.dimensoes.length, 5);
  assert.deepEqual(rel.alertas, []);
  assert.equal(rel.criadaEm, AGORA.toISOString());
  assert.equal(rel.versaoMapeamento, 1);
});

test("o perfil e a pontuação do resultado atual são os de evaluate(), sem alteração", async () => {
  for (const [nome, ex] of Object.entries(EXEMPLOS)) {
    const r = await montarRelatorio({ answers: respostasJson(ex.respostas) }, null, deps());
    assert.equal(r.status, "ok", nome);
    if (r.status !== "ok") continue;
    const { score, profile } = evaluate(ex.respostas);
    assert.equal(r.relatorio.perfil, profile, nome);
    assert.equal(r.relatorio.pontuacao, score, nome);
    assert.deepEqual(r.relatorio.alertas.map((a) => a.id), ex.esperado, nome);
  }
});

test("anônimo com o id de uma análise anônima e as respostas: usa as respostas e ignora o id", async () => {
  const r = await montarRelatorio({ id: ID_ATUAL, answers: respostasJson(EXEMPLOS.coerente.respostas) }, null, deps());
  assert.equal(r.status, "ok");
});

test("anônimo com id e sem respostas: não encontrada (análise anônima nunca é devolvida)", async () => {
  assert.deepEqual(await montarRelatorio({ id: ID_ATUAL }, null, deps()), { status: "nao-encontrada" });
});

test("id que não é um UUID, sem respostas, é não encontrada", async () => {
  assert.deepEqual(await montarRelatorio({ id: "1; DROP TABLE" }, USER, deps()), { status: "nao-encontrada" });
  assert.deepEqual(await montarRelatorio({ id: 42 }, USER, deps()), { status: "invalida", erro: "Informe a análise ou as respostas." });
});

test("sem id e sem respostas: pedido inválido", async () => {
  for (const corpo of [{}, null, undefined, "texto", []]) {
    const r = await montarRelatorio(corpo, null, deps());
    assert.equal(r.status, "invalida", JSON.stringify(corpo));
  }
});

test("respostas incompletas ou inválidas: pedido inválido, sem calcular nada", async () => {
  const completo = respostasJson(EXEMPLOS.coerente.respostas) as Record<string, unknown>;
  const faltando = { ...completo };
  delete faltando["9"];
  for (const answers of [faltando, { ...completo, "2": "Z" }, {}, "x", [1, 2, 3]]) {
    const r = await montarRelatorio({ answers }, null, deps());
    assert.deepEqual(r, { status: "invalida", erro: "Responda todas as 18 questões." }, JSON.stringify(answers).slice(0, 40));
  }
});

/* ------------------------------ Propriedade ------------------------------ */

test("análise de outra conta (ou anônima) logado e sem respostas: não encontrada", async () => {
  let args: unknown[] = [];
  const r = await montarRelatorio(
    { id: ID_ATUAL },
    USER,
    deps({
      getSession: async (...a) => {
        args = a;
        return null;
      },
    }),
  );
  assert.deepEqual(r, { status: "nao-encontrada" });
  assert.deepEqual(args, [ID_ATUAL, USER], "a consulta precisa filtrar pela conta");
});

test("logado, com id que não é dele e respostas: calcula só o resultado atual, sem dados do id", async () => {
  const r = await montarRelatorio(
    { id: ID_ATUAL, answers: respostasJson(EXEMPLOS.coerente.respostas) },
    USER,
    deps({ getSession: async () => null, listRecent: async () => [], getLatest: async () => null }),
  );
  assert.equal(r.status, "ok");
  if (r.status === "ok") assert.equal(r.relatorio.origem, "atual");
});

/* ------------------------- Análise da conta (histórico) ------------------------- */

test("análise antiga da conta ganha as dimensões a partir das respostas guardadas", async () => {
  const respostas = EXEMPLOS["capacidade-baixa-perfil-arrojado"].respostas;
  const r = await montarRelatorio(
    { id: ID_ATUAL },
    USER,
    deps({
      getSession: async () => guardado(ID_ATUAL, haDias(100), respostasJson(respostas)),
      listRecent: async () => [],
      getLatest: async () => resumo(ID_ATUAL, haDias(100)),
    }),
  );
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  assert.equal(r.relatorio.origem, "conta");
  assert.equal(r.relatorio.logado, true);
  assert.equal(r.relatorio.criadaEm, haDias(100));
  assert.deepEqual(r.relatorio.alertas.map((a) => a.id), ["capacidade-baixa-perfil-arrojado"]);
});

test("perfil e pontuação da análise guardada vêm do banco, não são recalculados", async () => {
  const stored = { ...guardado(ID_ATUAL, haDias(10), respostasJson(EXEMPLOS.coerente.respostas)), score: 40, profile: "Moderado" as Profile };
  const r = await montarRelatorio(
    { id: ID_ATUAL },
    USER,
    deps({ getSession: async () => stored, listRecent: async () => [], getLatest: async () => resumo(ID_ATUAL, haDias(10)) }),
  );
  assert.equal(r.status, "ok");
  if (r.status === "ok") {
    assert.equal(r.relatorio.pontuacao, 40);
    assert.equal(r.relatorio.perfil, "Moderado");
  }
});

test("análise antiga sem respostas completas: indisponível, com mensagem clara, sem quebrar", async () => {
  const r = await montarRelatorio({ id: ID_ATUAL }, USER, deps({ getSession: async () => incompleto(ID_ATUAL, haDias(500)) }));
  assert.deepEqual(r, { status: "indisponivel", motivo: MSG_INCOMPLETA });
  assert.match(MSG_INCOMPLETA, /não tem todas as respostas/);
});

test("respostas guardadas em formato estranho (nulo, texto, lista) são tratadas como incompletas", async () => {
  for (const answers of [null, "x", [], 5, { "1": "A" }]) {
    const r = await montarRelatorio(
      { id: ID_ATUAL },
      USER,
      deps({ getSession: async () => ({ id: ID_ATUAL, createdAt: haDias(1), score: 30, profile: "Conservador", answers }) }),
    );
    assert.equal(r.status, "indisponivel", JSON.stringify(answers));
  }
});

/* ------------------------------- Evolução ------------------------------- */

test("com duas análises, compara com a anterior e informa o que mudou", async () => {
  const atual = EXEMPLOS.coerente.respostas;
  const anterior = montarRespostas("B");
  let consulta: unknown[] = [];
  const r = await montarRelatorio(
    { id: ID_ATUAL },
    USER,
    deps({
      getSession: async () => guardado(ID_ATUAL, haDias(1), respostasJson(atual)),
      listRecent: async (...a) => {
        consulta = a;
        return [guardado(ID_ANTERIOR, haDias(200), respostasJson(anterior))];
      },
      getLatest: async () => resumo(ID_ATUAL, haDias(1)),
    }),
  );
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  assert.deepEqual(consulta.slice(0, 2), [USER, haDias(1)], "busca só análises anteriores a esta, da mesma conta");
  const ev = r.relatorio.evolucao;
  assert.ok(ev);
  assert.equal(r.relatorio.motivoSemEvolucao, null);
  assert.equal(ev.anterior.id, ID_ANTERIOR);
  const tolerancia = ev.variacoes.find((v) => v.id === "tolerancia")!;
  assert.equal(tolerancia.de, 33);
  assert.equal(tolerancia.para, 62);
  assert.equal(tolerancia.sentido, "subiu");
  assert.match(ev.resumo, /Tolerância a perdas subiu 29 pontos percentuais/);
});

test("logado com uma só análise: sem comparação possível", async () => {
  const r = await montarRelatorio(
    { id: ID_ATUAL },
    USER,
    deps({
      getSession: async () => guardado(ID_ATUAL, haDias(1), respostasJson(EXEMPLOS.coerente.respostas)),
      listRecent: async () => [],
      getLatest: async () => resumo(ID_ATUAL, haDias(1)),
    }),
  );
  assert.equal(r.status, "ok");
  if (r.status === "ok") {
    assert.equal(r.relatorio.evolucao, null);
    assert.equal(r.relatorio.motivoSemEvolucao, "primeira-analise");
  }
});

test("a própria análise nunca é comparada com ela mesma", async () => {
  const r = await montarRelatorio(
    { id: ID_ATUAL },
    USER,
    deps({
      getSession: async () => guardado(ID_ATUAL, haDias(1), respostasJson(EXEMPLOS.coerente.respostas)),
      listRecent: async () => [guardado(ID_ATUAL, haDias(1), respostasJson(EXEMPLOS.coerente.respostas))],
      getLatest: async () => resumo(ID_ATUAL, haDias(1)),
    }),
  );
  assert.equal(r.status === "ok" && r.relatorio.motivoSemEvolucao, "primeira-analise");
});

test("análise anterior sem respostas completas é pulada: usa a anterior a ela", async () => {
  const r = await montarRelatorio(
    { id: ID_ATUAL },
    USER,
    deps({
      getSession: async () => guardado(ID_ATUAL, haDias(1), respostasJson(EXEMPLOS.coerente.respostas)),
      listRecent: async () => [incompleto(ID_ANTERIOR, haDias(100)), guardado(ID_ANTIGA, haDias(300), respostasJson(montarRespostas("A")))],
      getLatest: async () => resumo(ID_ATUAL, haDias(1)),
    }),
  );
  assert.equal(r.status, "ok");
  if (r.status === "ok") assert.equal(r.relatorio.evolucao?.anterior.id, ID_ANTIGA);
});

test("todas as anteriores incompletas: sem evolução, mas o relatório sai", async () => {
  const r = await montarRelatorio(
    { id: ID_ATUAL },
    USER,
    deps({
      getSession: async () => guardado(ID_ATUAL, haDias(1), respostasJson(EXEMPLOS.coerente.respostas)),
      listRecent: async () => [incompleto(ID_ANTERIOR, haDias(100)), incompleto(ID_ANTIGA, haDias(300))],
      getLatest: async () => resumo(ID_ATUAL, haDias(1)),
    }),
  );
  assert.equal(r.status, "ok");
  if (r.status === "ok") {
    assert.equal(r.relatorio.evolucao, null);
    assert.equal(r.relatorio.motivoSemEvolucao, "indisponivel");
    assert.equal(r.relatorio.dimensoes.length, 5);
  }
});

test("resultado atual de conta cuja gravação falhou: compara com a análise mais recente", async () => {
  let consulta: unknown[] = [];
  const r = await montarRelatorio(
    { answers: respostasJson(EXEMPLOS.coerente.respostas) },
    USER,
    deps({
      listRecent: async (...a) => {
        consulta = a;
        return [guardado(ID_ANTERIOR, haDias(50), respostasJson(montarRespostas("B")))];
      },
      getLatest: async () => resumo(ID_ANTERIOR, haDias(50)),
    }),
  );
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  assert.equal(consulta[1], null, "sem data limite: compara com a mais recente guardada");
  assert.equal(r.relatorio.origem, "atual");
  assert.equal(r.relatorio.evolucao?.anterior.id, ID_ANTERIOR);
  assert.equal(r.relatorio.reavaliacao, null, "resultado que acabou de sair não pede reavaliação");
});

test("perguntas mudaram entre as duas análises (versões diferentes): não compara", async () => {
  const v1: Mapeamento = { ...MAPEAMENTOS[0], versao: 1, validoDesde: "2020-01-01T00:00:00.000Z" };
  const v2: Mapeamento = { ...MAPEAMENTOS[0], versao: 2, validoDesde: haDias(150) };
  const r = await montarRelatorio(
    { id: ID_ATUAL },
    USER,
    deps({
      mapeamentos: [v1, v2],
      getSession: async () => guardado(ID_ATUAL, haDias(1), respostasJson(EXEMPLOS.coerente.respostas)),
      listRecent: async () => [guardado(ID_ANTERIOR, haDias(200), respostasJson(montarRespostas("B")))],
      getLatest: async () => resumo(ID_ATUAL, haDias(1)),
    }),
  );
  assert.equal(r.status, "ok");
  if (r.status === "ok") {
    assert.equal(r.relatorio.versaoMapeamento, 2);
    assert.equal(r.relatorio.evolucao, null);
    assert.equal(r.relatorio.motivoSemEvolucao, "versao-diferente");
  }
});

test("análise antiga é lida com o mapeamento da época (versão 1), mesmo existindo uma versão nova", async () => {
  const v1: Mapeamento = { ...MAPEAMENTOS[0], versao: 1, validoDesde: "2020-01-01T00:00:00.000Z" };
  const v2: Mapeamento = { ...MAPEAMENTOS[0], versao: 2, validoDesde: haDias(30) };
  const r = await montarRelatorio(
    { id: ID_ATUAL },
    USER,
    deps({
      mapeamentos: [v1, v2],
      getSession: async () => guardado(ID_ATUAL, haDias(100), respostasJson(EXEMPLOS.coerente.respostas)),
      listRecent: async () => [],
      getLatest: async () => resumo(ID_ATUAL, haDias(100)),
    }),
  );
  assert.equal(r.status === "ok" && r.relatorio.versaoMapeamento, 1);
});

/* ------------------------------- Lembrete ------------------------------- */

async function reavaliacaoDe(idadeDias: number, alvoEhUltima = true) {
  const r = await montarRelatorio(
    { id: ID_ATUAL },
    USER,
    deps({
      getSession: async () => guardado(ID_ATUAL, haDias(idadeDias), respostasJson(EXEMPLOS.coerente.respostas)),
      listRecent: async () => [],
      getLatest: async () => (alvoEhUltima ? resumo(ID_ATUAL, haDias(idadeDias)) : resumo(ID_ANTERIOR, haDias(5))),
    }),
  );
  assert.equal(r.status, "ok");
  return r.status === "ok" ? r.relatorio.reavaliacao : undefined;
}

test("lembrete aparece só quando a última análise tem mais de 12 meses", async () => {
  assert.equal(await reavaliacaoDe(10), null);
  assert.equal(await reavaliacaoDe(364), null);
  assert.equal(await reavaliacaoDe(365), null);
  assert.deepEqual(await reavaliacaoDe(366), { ultimaAnalise: haDias(366) });
  assert.deepEqual(await reavaliacaoDe(900), { ultimaAnalise: haDias(900) });
});

test("análise antiga que não é a mais recente da conta não mostra o lembrete", async () => {
  assert.equal(await reavaliacaoDe(700, false), null);
});

test("falha ao consultar a última análise não derruba o relatório nem mostra lembrete", async () => {
  const r = await montarRelatorio(
    { id: ID_ATUAL },
    USER,
    deps({
      getSession: async () => guardado(ID_ATUAL, haDias(800), respostasJson(EXEMPLOS.coerente.respostas)),
      listRecent: async () => [],
      getLatest: async () => {
        throw new Error("banco fora do ar");
      },
    }),
  );
  assert.equal(r.status, "ok");
  if (r.status === "ok") assert.equal(r.relatorio.reavaliacao, null);
});

/* --------------------------- Falhas do banco --------------------------- */

test("banco fora do ar ao buscar análises anteriores: relatório sai sem evolução", async () => {
  const r = await montarRelatorio(
    { id: ID_ATUAL },
    USER,
    deps({
      getSession: async () => guardado(ID_ATUAL, haDias(1), respostasJson(EXEMPLOS.coerente.respostas)),
      listRecent: async () => {
        throw new Error("banco fora do ar");
      },
      getLatest: async () => resumo(ID_ATUAL, haDias(1)),
    }),
  );
  assert.equal(r.status, "ok");
  if (r.status === "ok") {
    assert.equal(r.relatorio.evolucao, null);
    assert.equal(r.relatorio.motivoSemEvolucao, "indisponivel");
    assert.equal(r.relatorio.dimensoes.length, 5);
  }
});

test("banco fora do ar ao ler a análise da conta: indisponível, nunca uma exceção", async () => {
  const r = await montarRelatorio(
    { id: ID_ATUAL },
    USER,
    deps({
      getSession: async () => {
        throw new Error("banco fora do ar");
      },
    }),
  );
  assert.deepEqual(r, { status: "indisponivel", motivo: MSG_CONSULTA });
});

test("banco fora do ar, mas com respostas na mão: calcula o resultado atual", async () => {
  const r = await montarRelatorio(
    { id: ID_ATUAL, answers: respostasJson(EXEMPLOS.coerente.respostas) },
    USER,
    deps({
      getSession: async () => {
        throw new Error("banco fora do ar");
      },
      listRecent: async () => {
        throw new Error("banco fora do ar");
      },
      getLatest: async () => {
        throw new Error("banco fora do ar");
      },
    }),
  );
  assert.equal(r.status, "ok");
  if (r.status === "ok") {
    assert.equal(r.relatorio.origem, "atual");
    assert.equal(r.relatorio.evolucao, null);
  }
});

test("o relatório só contém o que a tela precisa: nenhum dado pessoal", async () => {
  const r = await montarRelatorio(
    { id: ID_ATUAL },
    USER,
    deps({
      getSession: async () => guardado(ID_ATUAL, haDias(1), respostasJson(EXEMPLOS.coerente.respostas)),
      listRecent: async () => [guardado(ID_ANTERIOR, haDias(100), respostasJson(montarRespostas("B")))],
      getLatest: async () => resumo(ID_ATUAL, haDias(1)),
    }),
  );
  assert.equal(r.status, "ok");
  if (r.status !== "ok") return;
  const json = JSON.stringify(r.relatorio);
  assert.doesNotMatch(json, new RegExp(USER));
  assert.doesNotMatch(json, /"answers"|"respostas"/);
  assert.equal(QUESTIONS.length, 18);
});
