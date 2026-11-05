/**
 * Evolução entre duas análises da mesma conta e lembrete de reavaliação (12 meses).
 * Funções puras; quem busca as análises no banco é o servico.ts.
 */
import { PROFILE_MAX_AGE_DAYS } from "../economia/leitura.ts";
import type { Profile } from "../suitability/scoring.ts";
import { DIMENSION_INFO, DIMENSION_ORDER, LIMITES, type DimensionId } from "./mapeamento.ts";
import type { Evolucao, VariacaoDimensao } from "./tipos.ts";

export interface AnaliseComNotas {
  id: string;
  createdAt: string;
  pontuacao: number;
  perfil: Profile;
  notas: Record<DimensionId, number>;
}

function pontos(n: number): string {
  const abs = Math.abs(n);
  return `${abs} ${abs === 1 ? "ponto percentual" : "pontos percentuais"}`;
}

/** "2026-03-12T10:00:00Z" -> "12/03/2026" (fuso de Brasília). */
export function dataBR(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** Lista em prosa: "A", "A e B", "A, B e C". */
function listar(itens: string[]): string {
  if (itens.length <= 1) return itens.join("");
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

/** Variação por dimensão: "subiu"/"caiu" só a partir de LIMITES.variacaoMinima pontos percentuais. */
export function compararAnalises(atual: AnaliseComNotas, anterior: AnaliseComNotas): Evolucao {
  const variacoes: VariacaoDimensao[] = DIMENSION_ORDER.map((id) => {
    const de = anterior.notas[id];
    const para = atual.notas[id];
    const delta = para - de;
    const sentido = delta >= LIMITES.variacaoMinima ? "subiu" : delta <= -LIMITES.variacaoMinima ? "caiu" : "estavel";
    return { id, nome: DIMENSION_INFO[id].nome, de, para, delta, sentido };
  });

  const mudouPerfil = atual.perfil !== anterior.perfil;
  const subiram = variacoes.filter((v) => v.sentido === "subiu");
  const cairam = variacoes.filter((v) => v.sentido === "caiu");

  const partes: string[] = [];
  if (subiram.length > 0) partes.push(`${listar(subiram.map((v) => `${v.nome} subiu ${pontos(v.delta)}`))}`);
  if (cairam.length > 0) partes.push(`${listar(cairam.map((v) => `${v.nome} caiu ${pontos(v.delta)}`))}`);
  const mudancas = partes.length > 0 ? `${partes.join("; ")}. As demais dimensões ficaram estáveis.` : "Nenhuma dimensão mudou de forma relevante: todas ficaram estáveis.";
  const perfil = mudouPerfil
    ? ` O perfil mudou de ${anterior.perfil} para ${atual.perfil}.`
    : ` O perfil continua ${atual.perfil}.`;

  return {
    anterior: {
      id: anterior.id,
      createdAt: anterior.createdAt,
      pontuacao: anterior.pontuacao,
      perfil: anterior.perfil,
      notas: DIMENSION_ORDER.map((id) => ({ id, nome: DIMENSION_INFO[id].nome, nota: anterior.notas[id] })),
    },
    variacoes,
    mudouPerfil,
    deltaPontuacao: atual.pontuacao - anterior.pontuacao,
    resumo: `Em relação à análise de ${dataBR(anterior.createdAt)}: ${mudancas}${perfil}`,
  };
}

/** A análise mais recente tem mais de 12 meses? (365 dias exatos ainda não contam.) */
export function precisaReavaliar(ultimaAnaliseIso: string, agora: Date): boolean {
  const idadeDias = (agora.getTime() - Date.parse(ultimaAnaliseIso)) / 86_400_000;
  return Number.isFinite(idadeDias) && idadeDias > PROFILE_MAX_AGE_DAYS;
}
