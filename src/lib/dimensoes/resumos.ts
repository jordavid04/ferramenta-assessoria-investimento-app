/**
 * Frases curtas que explicam a nota de cada dimensão. São textos fixos escolhidos pelo sistema (a IA não
 * participa), neutros e sem promessa. Ficam aqui para facilitar a revisão.
 */
import type { OptionKey } from "../suitability/questions.ts";
import type { DimensionId, Faixa } from "./mapeamento.ts";

const POR_FAIXA: Record<Exclude<DimensionId, "horizonte">, Record<Faixa, string>> = {
  tolerancia: {
    baixa: "Você prefere evitar oscilações e tende a reagir com cautela diante de quedas.",
    media: "Você aceita algumas oscilações, mas com limites quando as quedas ficam maiores.",
    alta: "Você tem alta tolerância a oscilações e a quedas temporárias.",
  },
  conhecimento: {
    baixa: "Você está começando: tem pouca familiaridade com os produtos de investimento.",
    media: "Você tem uma familiaridade intermediária com os produtos e com o mercado.",
    alta: "Você tem boa familiaridade com os produtos de investimento e alguma experiência prática.",
  },
  situacao: {
    baixa: "Suas respostas sobre idade, renda, poupança e patrimônio indicam uma capacidade limitada de absorver perdas.",
    media: "Suas respostas sobre idade, renda, poupança e patrimônio indicam uma capacidade intermediária de absorver perdas.",
    alta: "Suas respostas sobre idade, renda, poupança e patrimônio indicam boa capacidade de absorver perdas temporárias.",
  },
  objetivo: {
    baixa: "Seu foco principal é preservar o patrimônio e ter segurança.",
    media: "Você busca equilibrar segurança, renda e crescimento moderado.",
    alta: "Seu foco é fazer o patrimônio crescer, aceitando mais risco por isso.",
  },
};

/** Horizonte depende da resposta (a pergunta tem só 4 alternativas): a frase descreve o prazo escolhido. */
const HORIZONTE: Record<OptionKey, string> = {
  A: "Horizonte curto: você pretende usar a maior parte do dinheiro em menos de 1 ano.",
  B: "Horizonte curto a médio: você pretende usar a maior parte do dinheiro entre 1 e 3 anos.",
  C: "Horizonte médio: você pretende usar a maior parte do dinheiro entre 3 e 5 anos.",
  D: "Horizonte longo: você pretende usar a maior parte do dinheiro depois de mais de 5 anos.",
};

export function resumoDaDimensao(id: DimensionId, faixa: Faixa, respostaHorizonte?: OptionKey): string {
  if (id === "horizonte") return HORIZONTE[respostaHorizonte ?? "B"];
  return POR_FAIXA[id][faixa];
}

/** Mensagem positiva quando nenhuma regra de inconsistência dispara. */
export const MENSAGEM_COERENCIA =
  "Não encontramos contradições entre as suas respostas: as dimensões parecem coerentes entre si.";
