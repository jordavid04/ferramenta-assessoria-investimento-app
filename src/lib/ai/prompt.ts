import { QUESTIONS, type OptionKey } from "../suitability/questions.ts";
import type { Answers, Profile } from "../suitability/scoring.ts";
import { BASE_ALLOCATION } from "./allocation.ts";

export interface RecommendationResult {
  /** Texto curto e didático explicando o perfil (equivalente ao card "IA - Explicação do perfil"). */
  profileExplanation: string;
  allocation: { assetClass: string; percent: number; rationale: string }[];
  /** Exemplos de tipos de produto por classe (sem promessa de rentabilidade). */
  suggestions: { assetClass: string; title: string; description: string; compatibility: number }[];
  educationalTips: string[];
  disclaimer: string;
}

export const DISCLAIMER =
  "Conteúdo educacional gerado por inteligência artificial a partir do seu questionário. Não constitui recomendação individualizada de investimento nem promessa de rentabilidade. Rentabilidade passada não garante resultados futuros. Consulte um profissional certificado antes de investir.";

export function buildPrompt(answers: Answers, score: number, profile: Profile): string {
  const resumo = QUESTIONS.map((q) => {
    const k: OptionKey = answers[q.id];
    return `${q.id}. ${q.text} -> ${k}) ${q.options[k]}`;
  }).join("\n");

  return `Você é um assistente de educação financeira para investidores iniciantes brasileiros (público prioritário: servidores públicos).
O perfil já foi calculado de forma determinística pelo sistema, com base nas regras de Suitability da ANBIMA. NÃO recalcule nem contradiga o perfil.

PERFIL CALCULADO: ${profile} (${score} de 72 pontos)
ALOCAÇÃO-BASE DO PERFIL (referência, a soma deve permanecer 100%):
${JSON.stringify(BASE_ALLOCATION[profile].map(({ assetClass, percent }) => ({ assetClass, percent })))}

RESPOSTAS DO INVESTIDOR:
${resumo}

TAREFA: devolva SOMENTE um JSON válido (sem markdown) com o formato:
{
  "profileExplanation": string (máx. 3 frases, linguagem simples, use uma analogia do cotidiano),
  "allocation": [{"assetClass": "Renda Fixa"|"Fundos Imobiliários"|"Ações"|"ETFs"|"Fundos", "percent": number, "rationale": string (1 frase)}],
  "suggestions": [{"assetClass": string, "title": string (tipo de produto, ex.: "Tesouro IPCA+"), "description": string (1 frase), "compatibility": number (0-100)}],
  "educationalTips": [string] (3 dicas curtas ligadas às respostas, ex.: reserva de emergência, horizonte de prazo),
  "disclaimer": string
}
REGRAS: a soma dos percent de allocation deve ser exatamente 100 e não pode se afastar mais de 10 pontos percentuais da alocação-base em nenhuma classe; cite apenas tipos de produto genéricos (Tesouro Selic, CDB, FII de logística, ETF de Ibovespa), nunca prometa rentabilidade, nunca cite tickers específicos como garantia; responda em português do Brasil.`;
}
