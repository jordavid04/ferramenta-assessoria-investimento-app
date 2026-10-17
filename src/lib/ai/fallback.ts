import type { Profile } from "../suitability/scoring.ts";
import { BASE_ALLOCATION } from "./allocation.ts";
import { DISCLAIMER, type RecommendationResult } from "./prompt.ts";

const EXPLANATION: Record<Profile, string> = {
  Conservador: "Perfil Conservador significa que você prioriza a segurança do seu dinheiro acima de ganhos altos. É como guardar o carro na garagem: você protege o patrimônio e aceita andar mais devagar.",
  Moderado: "Perfil Moderado significa que você busca crescer o patrimônio sem correr riscos extremos. É como dirigir na faixa do meio: nem parado na garagem, nem acelerando na contramão.",
  Arrojado: "Perfil Arrojado significa que você aceita oscilações relevantes em busca de crescimento no longo prazo. É como uma viagem de estrada com trechos de chuva: a chegada compensa se houver paciência.",
  Agressivo: "Perfil Agressivo significa que você busca retornos maiores e tolera grandes oscilações e possíveis perdas. É como esportes radicais: alta emoção exige preparo e disciplina.",
};

const SUGGESTIONS: Record<string, { title: string; description: string }> = {
  "Renda Fixa": { title: "Tesouro Selic / Tesouro IPCA+", description: "Títulos públicos para reserva de emergência (Selic) e proteção contra inflação no longo prazo (IPCA+)." },
  "Fundos Imobiliários": { title: "FIIs de logística e papel", description: "Fundos diversificados que distribuem renda mensal; avalie liquidez e vacância." },
  "ETFs": { title: "ETF de Ibovespa ou S&P 500", description: "Exposição diversificada a muitas empresas com um único papel e baixo custo." },
  "Ações": { title: "Ações de empresas pagadoras de dividendos", description: "Empresas sólidas e de setores variados; exigem acompanhamento e horizonte longo." },
  "Fundos": { title: "Fundos DI ou multimercado", description: "Gestão profissional para quem prefere delegar; compare taxas de administração." },
};

/** Motor local, 100% determinístico. Usado quando a API do Gemini falha ou não está configurada. */
export function fallbackRecommendation(profile: Profile): RecommendationResult {
  const allocation = BASE_ALLOCATION[profile];
  const top = Math.max(...allocation.map((a) => a.percent));
  return {
    profileExplanation: EXPLANATION[profile],
    allocation: allocation.map(({ assetClass, percent, rationale }) => ({ assetClass, percent, rationale })),
    suggestions: allocation
      .filter((a) => a.percent > 0)
      .map((a) => ({
        assetClass: a.assetClass,
        title: SUGGESTIONS[a.assetClass].title,
        description: SUGGESTIONS[a.assetClass].description,
        compatibility: Math.round(60 + (a.percent / top) * 35),
      })),
    educationalTips: [
      "Antes de investir em ativos de risco, monte uma reserva de emergência equivalente a 6 meses de despesas em liquidez diária.",
      "Diversificar entre classes de ativos reduz o impacto de uma queda isolada na sua carteira.",
      "Defina o prazo de cada objetivo: dinheiro que será usado em menos de 2 anos não deve ficar em renda variável.",
    ],
    disclaimer: DISCLAIMER,
  };
}
