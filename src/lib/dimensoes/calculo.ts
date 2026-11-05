/**
 * Cálculo das notas por dimensão e montagem da análise (notas + resumos + alertas) a partir das respostas.
 * Função pura: não acessa banco, nem IA, e nunca altera pontuação ou perfil (esses chegam prontos).
 */
import { QUESTIONS, type OptionKey } from "../suitability/questions.ts";
import { POINTS, type Answers, type Profile } from "../suitability/scoring.ts";
import {
  DIMENSION_INFO,
  DIMENSION_ORDER,
  faixaDe,
  perguntasDoMapeamento,
  type DimensionId,
  type Mapeamento,
} from "./mapeamento.ts";
import { avaliarRegras } from "./regras.ts";
import { resumoDaDimensao } from "./resumos.ts";
import type { Alerta, NotaDimensao } from "./tipos.ts";

const isOption = (v: unknown): v is OptionKey => v === "A" || v === "B" || v === "C" || v === "D";

/**
 * Lê as respostas guardadas ({"1":"C",...}) ou enviadas. Devolve null se faltar qualquer pergunta do
 * mapeamento ou houver valor inválido (análise antiga/incompleta: as dimensões não são calculadas).
 */
export function lerRespostas(raw: unknown, mapeamento: Mapeamento): Answers | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const fonte = raw as Record<string, unknown>;
  const out: Answers = {};
  for (const id of perguntasDoMapeamento(mapeamento)) {
    const v = fonte[String(id)];
    if (!isOption(v)) return null;
    out[id] = v;
  }
  return out;
}

/** Nota (0 a 100) de uma dimensão: soma dos pontos reescalada entre o mínimo (todas A) e o máximo (todas D). */
export function notaDaDimensao(perguntas: number[], respostas: Answers): number {
  const n = perguntas.length;
  if (n === 0) throw new Error("Dimensão sem perguntas");
  const soma = perguntas.reduce((s, id) => {
    const r = respostas[id];
    if (!r || !(r in POINTS)) throw new Error(`Resposta ausente ou inválida para a questão ${id}`);
    return s + POINTS[r];
  }, 0);
  return Math.round(((soma - n) / (3 * n)) * 100);
}

export function calcularNotas(respostas: Answers, mapeamento: Mapeamento): Record<DimensionId, number> {
  const notas = {} as Record<DimensionId, number>;
  for (const d of DIMENSION_ORDER) notas[d] = notaDaDimensao(mapeamento.perguntas[d], respostas);
  return notas;
}

export interface Analise {
  dimensoes: NotaDimensao[];
  alertas: Alerta[];
  notas: Record<DimensionId, number>;
}

export interface DadosDaAnalise {
  respostas: Answers;
  perfil: Profile;
  pontuacao: number;
  mapeamento: Mapeamento;
}

/** Notas, resumos por dimensão e alertas de coerência. O perfil e a pontuação entram só como contexto das regras. */
export function analisar({ respostas, perfil, pontuacao, mapeamento }: DadosDaAnalise): Analise {
  const notas = calcularNotas(respostas, mapeamento);

  const dimensoes: NotaDimensao[] = DIMENSION_ORDER.map((id) => {
    const nota = notas[id];
    const faixa = faixaDe(nota);
    const idDestaque = mapeamento.destaque[id];
    const pergunta = idDestaque ? QUESTIONS.find((q) => q.id === idDestaque) : undefined;
    const respostaDestaque = idDestaque ? respostas[idDestaque] : undefined;
    return {
      id,
      nome: DIMENSION_INFO[id].nome,
      nota,
      faixa,
      perguntas: mapeamento.perguntas[id].length,
      resumo: resumoDaDimensao(id, faixa, id === "horizonte" ? respostas[mapeamento.perguntas.horizonte[0]] : undefined),
      detalhe: pergunta && respostaDestaque ? pergunta.options[respostaDestaque] : null,
    };
  });

  const alertas = avaliarRegras({ notas, respostas, perfil, pontuacao });
  return { dimensoes, alertas, notas };
}
