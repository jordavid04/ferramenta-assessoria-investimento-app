import { test } from "node:test";
import assert from "node:assert/strict";
import { QUESTIONS, type OptionKey } from "../suitability/questions.ts";
import { evaluate, type Answers } from "../suitability/scoring.ts";
import { analisar } from "./calculo.ts";
import { compararAnalises } from "./evolucao.ts";
import { EXEMPLOS, montarRespostas } from "./exemplos.ts";
import { checarLeitura } from "./guarda.ts";
import {
  AI_FAILURE_BACKOFF_MS,
  buildLeituraPrompt,
  createLeituraCache,
  createLeituraService,
  leituraCacheKey,
  leituraLocal,
  LEITURA_TTL_MS,
  parseLeitura,
  type LeituraCache,
} from "./leitura.ts";
import { MAPEAMENTOS } from "./mapeamento.ts";
import type { EntradaLeitura, Evolucao } from "./tipos.ts";

const m = MAPEAMENTOS[0];

function entradaDe(respostas: Answers, anterior?: Answers): EntradaLeitura {
  const { score, profile } = evaluate(respostas);
  const a = analisar({ respostas, perfil: profile, pontuacao: score, mapeamento: m });
  let evolucao: Evolucao | null = null;
  if (anterior) {
    const ev = evaluate(anterior);
    const b = analisar({ respostas: anterior, perfil: ev.profile, pontuacao: ev.score, mapeamento: m });
    evolucao = compararAnalises(
      { id: "atual", createdAt: "2026-11-04T12:00:00.000Z", pontuacao: score, perfil: profile, notas: a.notas },
      { id: "antiga", createdAt: "2026-03-12T15:00:00.000Z", pontuacao: ev.score, perfil: ev.profile, notas: b.notas },
    );
  }
  return { perfil: profile, pontuacao: score, dimensoes: a.dimensoes, alertas: a.alertas, evolucao };
}

/** Gerador pseudoaleatório fixo (os testes precisam ser reproduzíveis). */
function sorteio(semente: number) {
  let s = semente;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
function respostasAleatorias(rand: () => number): Answers {
  const letras: OptionKey[] = ["A", "B", "C", "D"];
  return Object.fromEntries(QUESTIONS.map((q) => [q.id, letras[Math.floor(rand() * 4)]]));
}

const COERENTE = entradaDe(EXEMPLOS.coerente.respostas);
const COM_ALERTA = entradaDe(EXEMPLOS["horizonte-curto-tolerancia-alta"].respostas);

const memoryCache = () =>
  createLeituraCache(() => new Date(), {
    getEconomicInsightRow: async () => null,
    saveEconomicInsightRow: async () => {},
  });

/* ----------------------------- Texto local ----------------------------- */

test("o texto local passa na própria verificação, em todos os exemplos, com e sem evolução", () => {
  for (const [nome, ex] of Object.entries(EXEMPLOS)) {
    for (const anterior of [undefined, montarRespostas("B"), EXEMPLOS.coerente.respostas, ex.respostas]) {
      const e = entradaDe(ex.respostas, anterior);
      const texto = leituraLocal(e);
      assert.deepEqual(checarLeitura(texto, e), [], `${nome}: ${texto}`);
    }
  }
});

test("o texto local passa na verificação para 600 combinações de respostas", () => {
  const rand = sorteio(2026);
  for (let i = 0; i < 600; i++) {
    const e = entradaDe(respostasAleatorias(rand), i % 2 === 0 ? respostasAleatorias(rand) : undefined);
    const texto = leituraLocal(e);
    assert.deepEqual(checarLeitura(texto, e), [], `caso ${i}: ${texto}`);
  }
});

test("o texto local é determinístico e cita perfil, pontuação e a dimensão mais alta e mais baixa", () => {
  const e = COM_ALERTA;
  assert.equal(leituraLocal(e), leituraLocal(e));
  const texto = leituraLocal(e);
  assert.match(texto, /Seu perfil é Arrojado, com 59 de 72 pontos/);
  assert.match(texto, /Tolerância a perdas é a dimensão mais alta \(100%\)/);
  assert.match(texto, /Horizonte de tempo é a mais baixa \(0%\)/);
});

test("o texto local fala dos alertas quando existem e de coerência quando não existem", () => {
  assert.match(leituraLocal(COM_ALERTA), /Horizonte curto com tolerância alta/);
  assert.match(leituraLocal(COM_ALERTA), /apenas informativos/);
  assert.match(leituraLocal(COERENTE), /parecem coerentes entre si/);
  assert.doesNotMatch(leituraLocal(COERENTE), /ponto de atenção:|segunda olhada/);
});

test("o texto local comenta a evolução e a mudança de perfil", () => {
  const e = entradaDe(montarRespostas("D", { 6: "A" }), montarRespostas("B"));
  const texto = leituraLocal(e);
  assert.match(texto, /Em relação à análise anterior/);
  assert.match(texto, /O perfil mudou de Moderado para Agressivo/);
  const igual = leituraLocal(entradaDe(montarRespostas("B"), montarRespostas("B")));
  assert.match(igual, /nenhuma dimensão mudou de forma relevante/);
  assert.match(igual, /O perfil continua Moderado/);
});

/* ------------------------------- Prompt ------------------------------- */

test("o prompt entrega perfil, notas e alertas prontos e proíbe recalcular", () => {
  const prompt = buildLeituraPrompt(COM_ALERTA);
  assert.match(prompt, /Arrojado, 59 de 72 pontos/);
  assert.match(prompt, /NÃO recalcule nem contradiga/);
  assert.match(prompt, /Tolerância a perdas.*100%/);
  assert.match(prompt, /Horizonte de tempo.*0%/);
  assert.match(prompt, /Horizonte curto com tolerância alta/);
  assert.match(prompt, /NUNCA diga que o perfil deveria ser outro/);
  assert.match(prompt, /NUNCA prometa/);
  assert.match(prompt, /tickers/);
  assert.match(prompt, /português do Brasil/);
  assert.match(prompt, /Não há análise anterior/);
});

test("o prompt diz que não há alertas quando o sistema não achou nenhum", () => {
  assert.match(buildLeituraPrompt(COERENTE), /Nenhum alerta/);
});

test("o prompt inclui a evolução quando existe", () => {
  const prompt = buildLeituraPrompt(entradaDe(montarRespostas("D", { 6: "A" }), montarRespostas("B")));
  assert.match(prompt, /Análise anterior: 36 de 72 pontos, perfil Moderado/);
  assert.match(prompt, /de 33% para 100%/);
  assert.doesNotMatch(prompt, /Não há análise anterior/);
});

test("parseLeitura valida o contrato da IA", () => {
  assert.equal(parseLeitura({ reading: "  texto  " }), "texto");
  assert.throws(() => parseLeitura({}), /fora do contrato/);
  assert.throws(() => parseLeitura({ reading: "  " }), /fora do contrato/);
  assert.throws(() => parseLeitura({ reading: 12 }), /fora do contrato/);
  assert.throws(() => parseLeitura(null), /fora do contrato/);
});

/* -------------------------------- Serviço -------------------------------- */

const BOM = "Seu perfil é Moderado, com 50 de 72 pontos. Vale pensar se as suas respostas representam bem o que você espera dos seus investimentos.";

test("sem chave da IA: texto local, identificado como offline (fallback)", async () => {
  let chamou = false;
  const svc = createLeituraService({ hasKey: () => false, cache: memoryCache(), generate: async () => ((chamou = true), {}) });
  const out = await svc.get(COERENTE);
  assert.equal(out.source, "fallback");
  assert.match(out.fallbackReason!, /GEMINI_API_KEY/);
  assert.equal(out.text, leituraLocal(COERENTE));
  assert.equal(chamou, false);
});

test("texto da IA válido é aceito e identificado como IA", async () => {
  const svc = createLeituraService({ hasKey: () => true, cache: memoryCache(), generate: async () => ({ reading: BOM }) });
  const out = await svc.get(COERENTE);
  assert.equal(out.source, "gemini");
  assert.equal(out.text, BOM);
  assert.equal(out.fallbackReason, undefined);
});

test("IA indisponível (erro): entra o texto local", async () => {
  const svc = createLeituraService({
    hasKey: () => true,
    cache: memoryCache(),
    generate: async () => {
      throw new Error("Gemini respondeu HTTP 503");
    },
  });
  const out = await svc.get(COERENTE);
  assert.equal(out.source, "fallback");
  assert.match(out.fallbackReason!, /503/);
  assert.equal(out.text, leituraLocal(COERENTE));
});

test("resposta inválida da IA (fora do contrato): entra o texto local", async () => {
  for (const resposta of [{ resposta: "x" }, null, "texto solto", { reading: "" }, { reading: 5 }]) {
    const svc = createLeituraService({ hasKey: () => true, cache: memoryCache(), generate: async () => resposta });
    const out = await svc.get(COERENTE);
    assert.equal(out.source, "fallback", JSON.stringify(resposta));
    assert.match(out.fallbackReason!, /fora do contrato/);
  }
});

test("texto da IA reprovado (promessa, recomendação, ticker, número, perfil, alertas) cai no texto local", async () => {
  const ruins = [
    "Você vai ter um patrimônio garantido.",
    "Compre ações agora.",
    "Considere PETR4 para o perfil Moderado.",
    "A sua tolerância a perdas está em 91%.",
    "Para o perfil Agressivo, a leitura seria outra.",
    "Seu perfil deveria ser mais conservador.",
    "Há uma inconsistência entre as suas respostas.", // não há alertas na entrada coerente
  ];
  for (const texto of ruins) {
    const svc = createLeituraService({ hasKey: () => true, cache: memoryCache(), generate: async () => ({ reading: texto }) });
    const out = await svc.get(COERENTE);
    assert.equal(out.source, "fallback", texto);
    assert.match(out.fallbackReason!, /reprovado/, texto);
    assert.equal(out.text, leituraLocal(COERENTE));
  }
  // com alertas, negar a inconsistência também é reprovado
  const svc = createLeituraService({
    hasKey: () => true,
    cache: memoryCache(),
    generate: async () => ({ reading: "Não há inconsistências nas suas respostas." }),
  });
  assert.equal((await svc.get(COM_ALERTA)).source, "fallback");
});

test("depois de uma falha, a IA não é chamada de novo durante o intervalo de espera", async () => {
  let agora = new Date("2026-11-04T12:00:00Z");
  let chamadas = 0;
  const svc = createLeituraService({
    hasKey: () => true,
    now: () => agora,
    cache: memoryCache(),
    generate: async () => {
      chamadas++;
      throw new Error("fora do ar");
    },
  });
  await svc.get(COERENTE);
  await svc.get(COERENTE);
  assert.equal(chamadas, 1);
  agora = new Date(agora.getTime() + AI_FAILURE_BACKOFF_MS + 1000);
  await svc.get(COERENTE);
  assert.equal(chamadas, 2);
});

test("o mesmo resultado não gera texto novo a cada visita (cache)", async () => {
  let chamadas = 0;
  const svc = createLeituraService({
    hasKey: () => true,
    cache: memoryCache(),
    generate: async () => {
      chamadas++;
      return { reading: BOM };
    },
  });
  await svc.get(COERENTE);
  const outra = await svc.get(entradaDe(EXEMPLOS.coerente.respostas));
  assert.equal(chamadas, 1);
  assert.equal(outra.text, BOM);
  assert.equal(outra.source, "gemini");
  // números diferentes => outra leitura
  await svc.get(COM_ALERTA);
  assert.equal(chamadas, 2);
});

test("leitura em cache vencida (30 dias) é gerada de novo", async () => {
  let agora = new Date("2026-11-04T12:00:00Z");
  let chamadas = 0;
  const cache = createLeituraCache(() => agora, { getEconomicInsightRow: async () => null, saveEconomicInsightRow: async () => {} });
  const svc = createLeituraService({
    hasKey: () => true,
    now: () => agora,
    cache,
    generate: async () => {
      chamadas++;
      return { reading: BOM };
    },
  });
  await svc.get(COERENTE);
  agora = new Date(agora.getTime() + LEITURA_TTL_MS + 1000);
  await svc.get(COERENTE);
  assert.equal(chamadas, 2);
});

test("chamadas simultâneas para o mesmo resultado dividem a mesma geração", async () => {
  let chamadas = 0;
  const svc = createLeituraService({
    hasKey: () => true,
    cache: memoryCache(),
    generate: async () => {
      chamadas++;
      await new Promise((r) => setTimeout(r, 5));
      return { reading: BOM };
    },
  });
  await Promise.all([svc.get(COERENTE), svc.get(COERENTE), svc.get(COERENTE)]);
  assert.equal(chamadas, 1);
});

test("texto em cache que não passa mais na verificação é ignorado", async () => {
  const cache = memoryCache();
  await cache.save(leituraCacheKey(COERENTE), "Você vai ter muito dinheiro.");
  const svc = createLeituraService({ hasKey: () => false, cache });
  const out = await svc.get(COERENTE);
  assert.equal(out.source, "fallback");
  assert.equal(out.text, leituraLocal(COERENTE));
});

test("falha do cache em banco não quebra a leitura (nem ao ler, nem ao gravar)", async () => {
  const bancoQuebrado = () =>
    createLeituraCache(() => new Date(), {
      getEconomicInsightRow: async () => {
        throw new Error("banco fora do ar");
      },
      saveEconomicInsightRow: async () => {
        throw new Error("banco fora do ar");
      },
    });
  const quebrado = bancoQuebrado();
  const comIA = createLeituraService({ hasKey: () => true, cache: quebrado, generate: async () => ({ reading: BOM }) });
  const out = await comIA.get(COERENTE);
  assert.equal(out.source, "gemini");
  assert.equal(out.text, BOM);

  const semIA = createLeituraService({ hasKey: () => false, cache: bancoQuebrado() });
  assert.equal((await semIA.get(COERENTE)).source, "fallback");
});

test("um cache que lança no próprio serviço não impede a leitura", async () => {
  const cacheRuim: LeituraCache = {
    load: async () => {
      throw new Error("explodiu");
    },
    save: async () => {
      throw new Error("explodiu");
    },
  };
  const svc = createLeituraService({ hasKey: () => true, cache: cacheRuim, generate: async () => ({ reading: BOM }) });
  const out = await svc.get(COERENTE);
  assert.equal(out.source, "gemini");
});

test("a chave de cache muda com os números e é estável para os mesmos números", () => {
  const base = leituraCacheKey(COERENTE);
  assert.match(base, /^dim\|v\d+\|[0-9a-f]{32}$/);
  assert.equal(base, leituraCacheKey(entradaDe(EXEMPLOS.coerente.respostas)));
  assert.notEqual(base, leituraCacheKey(COM_ALERTA));
  assert.notEqual(base, leituraCacheKey(entradaDe(montarRespostas("C", { 1: "A" }))));
  // evolução diferente => outra leitura
  const comEvolucao = entradaDe(EXEMPLOS.coerente.respostas, montarRespostas("B"));
  assert.notEqual(base, leituraCacheKey(comEvolucao));
  assert.notEqual(leituraCacheKey(comEvolucao), leituraCacheKey(entradaDe(EXEMPLOS.coerente.respostas, montarRespostas("A"))));
});

test("a chave de cache não guarda dado pessoal: só um hash", () => {
  const chave = leituraCacheKey(COM_ALERTA);
  assert.doesNotMatch(chave, /Arrojado|usuario|user/i);
});
