/**
 * Mapeamento pergunta -> dimensão do perfil multidimensional. É o ÚNICO lugar que decide em qual
 * dimensão cada uma das 18 perguntas conta (cada pergunta pertence a exatamente uma dimensão).
 *
 * Nota de uma dimensão = (soma dos pontos - n) / (3 * n) * 100, arredondada: 0% (todas A) a 100% (todas D).
 * O módulo é só informativo: não altera pontuação, perfil nem alocação (isso continua em suitability/scoring.ts).
 *
 * Mudança nas perguntas: NÃO edite uma versão que já existe. Acrescente uma nova entrada em MAPEAMENTOS com
 * `validoDesde` na data de publicação das novas perguntas. Cada análise usa o mapeamento da data em que foi
 * criada (`created_at`), então análises antigas continuam sendo lidas com as perguntas da época. Não se compara
 * a evolução entre análises de versões diferentes (as dimensões podem não ser comparáveis).
 */

export type DimensionId = "tolerancia" | "horizonte" | "conhecimento" | "situacao" | "objetivo";

/** Ordem de exibição (eixos do radar, no sentido horário a partir do topo). */
export const DIMENSION_ORDER: DimensionId[] = ["tolerancia", "horizonte", "conhecimento", "situacao", "objetivo"];

export const DIMENSION_INFO: Record<DimensionId, { nome: string; significado: string }> = {
  tolerancia: { nome: "Tolerância a perdas", significado: "como você reage a quedas e oscilações" },
  horizonte: { nome: "Horizonte de tempo", significado: "em quanto tempo pretende usar o dinheiro" },
  conhecimento: { nome: "Conhecimento e experiência", significado: "sua familiaridade com os produtos de investimento" },
  situacao: { nome: "Situação financeira", significado: "sua capacidade financeira de absorver perdas" },
  objetivo: { nome: "Objetivo", significado: "o que você busca com os investimentos" },
};

export interface Mapeamento {
  versao: number;
  /** Análises criadas a partir deste instante (ISO) usam este mapeamento. */
  validoDesde: string;
  /** Perguntas de cada dimensão. */
  perguntas: Record<DimensionId, number[]>;
  /** Dimensões com poucas perguntas: a resposta desta pergunta aparece junto da nota, para a nota fazer sentido. */
  destaque: Partial<Record<DimensionId, number>>;
}

export const MAPEAMENTOS: Mapeamento[] = [
  {
    versao: 1,
    validoDesde: "1970-01-01T00:00:00.000Z",
    perguntas: {
      // Q10 perda de 5% · Q11 perda de 15% · Q13 carteira escolhida · Q14 % em ativos de risco
      // Q16 aceita oscilar · Q17 tolerância declarada · Q18 frase do investidor
      tolerancia: [10, 11, 13, 14, 16, 17, 18],
      // Q6 prazo para usar o dinheiro (única pergunta: nota em 4 degraus: 0, 33, 67, 100)
      horizonte: [6],
      // Q7 conhecimento · Q8 produtos já usados · Q9 tempo de experiência · Q15 frequência de acompanhamento
      conhecimento: [7, 8, 9, 15],
      // Q1 idade · Q2 fonte de renda · Q3 % poupado · Q4 patrimônio (capacidade, não vontade, de correr risco)
      situacao: [1, 2, 3, 4],
      // Q5 objetivo principal · Q12 o que é mais importante (segurança x retorno)
      objetivo: [5, 12],
    },
    destaque: { horizonte: 6, objetivo: 5 },
  },
];

/** Mapeamento da data da análise. Data inválida usa o mais recente. */
export function escolherMapeamento(createdAt: string | Date, lista: Mapeamento[] = MAPEAMENTOS): Mapeamento {
  const t = new Date(createdAt).getTime();
  const ordenada = [...lista].sort((a, b) => Date.parse(a.validoDesde) - Date.parse(b.validoDesde));
  if (!Number.isFinite(t)) return ordenada[ordenada.length - 1];
  let escolhido = ordenada[0];
  for (const m of ordenada) if (Date.parse(m.validoDesde) <= t) escolhido = m;
  return escolhido;
}

export function perguntasDoMapeamento(m: Mapeamento): number[] {
  return DIMENSION_ORDER.flatMap((d) => m.perguntas[d]);
}

/* ---------------------------------- Faixas ---------------------------------- */

export type Faixa = "baixa" | "media" | "alta";

/** Limites (em %) usados nos textos e nas regras de inconsistência. Ajuste só aqui. */
export const LIMITES = {
  /** nota <= 33 => faixa baixa (média de respostas B ou menos) */
  baixaAte: 33,
  /** nota >= 67 => faixa alta (média de respostas C ou mais) */
  altaDesde: 67,
  /** nota >= 75 => "muito alta" (usada nas regras de inconsistência) */
  muitoAltaDesde: 75,
  /** variação (em pontos percentuais) a partir da qual uma dimensão "subiu" ou "caiu" entre duas análises */
  variacaoMinima: 10,
} as const;

export function faixaDe(nota: number): Faixa {
  if (nota <= LIMITES.baixaAte) return "baixa";
  if (nota >= LIMITES.altaDesde) return "alta";
  return "media";
}

/** Rótulo da faixa para o texto. */
export const FAIXA_ROTULO: Record<Faixa, string> = { baixa: "faixa baixa", media: "faixa média", alta: "faixa alta" };
