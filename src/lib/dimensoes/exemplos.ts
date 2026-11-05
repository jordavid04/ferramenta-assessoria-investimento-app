/**
 * Conjuntos de respostas prontos para testar o módulo (automático e manualmente): um que dispara cada alerta
 * e um coerente. Os testes garantem que cada conjunto dispara exatamente os alertas indicados em `esperado`.
 * Não é usado em produção.
 */
import { QUESTIONS, type OptionKey } from "../suitability/questions.ts";
import type { Answers } from "../suitability/scoring.ts";

/** Todas as questões em `base`, com as trocas indicadas. */
export function montarRespostas(base: OptionKey, trocas: Partial<Record<number, OptionKey>> = {}): Answers {
  return Object.fromEntries(QUESTIONS.map((q) => [q.id, trocas[q.id] ?? base]));
}

const ids = (lista: number[], valor: OptionKey): Partial<Record<number, OptionKey>> =>
  Object.fromEntries(lista.map((id) => [id, valor]));

const TOLERANCIA = [10, 11, 13, 14, 16, 17, 18];
const CONHECIMENTO = [7, 8, 9, 15];
const SITUACAO = [1, 2, 3, 4];

export interface Exemplo {
  descricao: string;
  respostas: Answers;
  /** Ids dos alertas esperados, na ordem em que as regras são avaliadas. */
  esperado: string[];
}

export const EXEMPLOS: Record<string, Exemplo> = {
  coerente: {
    descricao: "Respostas equilibradas, sem contradições (perfil Moderado, 50 pontos).",
    respostas: montarRespostas("C", { 1: "B", 4: "B", 9: "B", 13: "B" }),
    esperado: [],
  },
  "horizonte-curto-tolerancia-alta": {
    descricao: "Quer usar o dinheiro em menos de 1 ano, mas responde tudo de tolerância no máximo (Arrojado, 59 pontos).",
    respostas: montarRespostas("C", { 6: "A", ...ids(TOLERANCIA, "D") }),
    esperado: ["horizonte-curto-tolerancia-alta"],
  },
  "pouco-conhecimento-respostas-agressivas": {
    descricao: "Conhecimento mínimo e respostas de tolerância no máximo (Arrojado, 54 pontos).",
    respostas: montarRespostas("C", { 6: "D", ...ids(CONHECIMENTO, "A"), ...ids(TOLERANCIA, "D") }),
    esperado: ["pouco-conhecimento-respostas-agressivas"],
  },
  "capacidade-baixa-perfil-arrojado": {
    descricao: "Idade, renda, poupança e patrimônio no mínimo, e o resto no máximo (Arrojado, 60 pontos).",
    respostas: montarRespostas("D", ids(SITUACAO, "A")),
    esperado: ["capacidade-baixa-perfil-arrojado"],
  },
  "preservar-aceitando-grandes-perdas": {
    descricao: "Objetivo de preservar capital, mas manteria o investimento numa queda de 15% (Moderado, 35 pontos).",
    respostas: montarRespostas("B", { 5: "A", 12: "A", 11: "C" }),
    esperado: ["preservar-aceitando-grandes-perdas"],
  },
  "disparidade-entre-dimensoes": {
    descricao: "Só o conhecimento no máximo; todas as outras dimensões no mínimo (Conservador, 30 pontos).",
    respostas: montarRespostas("A", ids(CONHECIMENTO, "D")),
    esperado: ["disparidade-entre-dimensoes"],
  },
  "respostas-uniformes": {
    descricao: "As 18 respostas na alternativa A (Conservador, 18 pontos).",
    respostas: montarRespostas("A"),
    esperado: ["respostas-uniformes"],
  },
};
