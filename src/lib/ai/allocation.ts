import type { Profile } from "../suitability/scoring.ts";

export type AssetClass = "Renda Fixa" | "Fundos Imobiliários" | "Ações" | "ETFs" | "Fundos";

export interface Allocation {
  assetClass: AssetClass;
  percent: number;
  rationale: string;
}

/**
 * Alocação-base por perfil. É o "piso" determinístico do sistema:
 * - serve de contexto para o prompt enviado ao Gemini;
 * - é usada como resposta quando a API de IA está indisponível (modo offline);
 * - serve de referência para validar a resposta da IA (soma = 100).
 * Valores didáticos, não constituem recomendação individualizada de investimento.
 */
export const BASE_ALLOCATION: Record<Profile, Allocation[]> = {
  Conservador: [
    { assetClass: "Renda Fixa", percent: 80, rationale: "Tesouro Selic, CDBs com liquidez e LCIs/LCAs preservam capital e protegem a reserva de emergência." },
    { assetClass: "Fundos", percent: 10, rationale: "Fundos DI/renda fixa simples oferecem gestão profissional com baixa oscilação." },
    { assetClass: "Fundos Imobiliários", percent: 10, rationale: "Pequena exposição a FIIs de papel/tijolo para renda mensal, aumentando a diversificação." },
    { assetClass: "ETFs", percent: 0, rationale: "Sem exposição à renda variável neste perfil." },
    { assetClass: "Ações", percent: 0, rationale: "Sem exposição direta a ações neste perfil." },
  ],
  Moderado: [
    { assetClass: "Renda Fixa", percent: 60, rationale: "Base de Tesouro IPCA+ e CDBs para proteção contra a inflação no médio prazo." },
    { assetClass: "Fundos Imobiliários", percent: 15, rationale: "FIIs diversificados geram renda recorrente com risco moderado." },
    { assetClass: "ETFs", percent: 10, rationale: "ETFs amplos (ex.: Ibovespa) dão exposição diversificada à bolsa a baixo custo." },
    { assetClass: "Fundos", percent: 10, rationale: "Fundos multimercado para diversificação com gestão ativa." },
    { assetClass: "Ações", percent: 5, rationale: "Parcela pequena em empresas sólidas e pagadoras de dividendos." },
  ],
  Arrojado: [
    { assetClass: "Renda Fixa", percent: 35, rationale: "Núcleo defensivo de Tesouro IPCA+ e crédito privado de boa qualidade." },
    { assetClass: "Ações", percent: 25, rationale: "Carteira de empresas de setores variados para buscar crescimento no longo prazo." },
    { assetClass: "Fundos Imobiliários", percent: 20, rationale: "FIIs para renda e diversificação setorial (logística, lajes, papel)." },
    { assetClass: "ETFs", percent: 15, rationale: "ETFs de bolsa local e internacional para diversificação geográfica." },
    { assetClass: "Fundos", percent: 5, rationale: "Fundos multimercado/long & short para descorrelação." },
  ],
  Agressivo: [
    { assetClass: "Ações", percent: 40, rationale: "Maior alocação em renda variável para maximizar crescimento, aceitando alta volatilidade." },
    { assetClass: "ETFs", percent: 20, rationale: "ETFs internacionais e setoriais para diversificar o risco da carteira de ações." },
    { assetClass: "Renda Fixa", percent: 20, rationale: "Reserva tática de Tesouro e CDBs para rebalancear em quedas de mercado." },
    { assetClass: "Fundos Imobiliários", percent: 15, rationale: "FIIs para fluxo de renda e diversificação." },
    { assetClass: "Fundos", percent: 5, rationale: "Fundos de ações/multimercado de gestão ativa." },
  ],
};

export function allocationSum(a: { percent: number }[]): number {
  return a.reduce((s, x) => s + x.percent, 0);
}
