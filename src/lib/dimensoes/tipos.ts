/** Tipos do relatório multidimensional (compartilhados entre servidor e tela; só tipos, sem código). */
import type { Profile } from "../suitability/scoring.ts";
import type { DimensionId, Faixa } from "./mapeamento.ts";

export interface NotaDimensao {
  id: DimensionId;
  nome: string;
  /** 0 a 100 (%). */
  nota: number;
  faixa: Faixa;
  /** Quantidade de perguntas da dimensão (poucas perguntas = nota em poucos degraus). */
  perguntas: number;
  /** Frase curta que explica a nota. */
  resumo: string;
  /** Resposta escolhida na pergunta de destaque (só em dimensões com poucas perguntas). */
  detalhe: string | null;
}

export interface Alerta {
  id: string;
  nome: string;
  /** "atencao" combinações que merecem uma segunda olhada; "info" observações gerais. Só muda o visual. */
  severidade: "atencao" | "info";
  texto: string;
  /** Frase de reflexão usada no texto local. */
  reflexao: string;
}

export interface VariacaoDimensao {
  id: DimensionId;
  nome: string;
  de: number;
  para: number;
  /** para - de, em pontos percentuais. */
  delta: number;
  sentido: "subiu" | "caiu" | "estavel";
}

export interface Evolucao {
  anterior: {
    id: string;
    createdAt: string;
    pontuacao: number;
    perfil: Profile;
    /** Notas da análise anterior, na ordem de DIMENSION_ORDER. */
    notas: { id: DimensionId; nome: string; nota: number }[];
  };
  variacoes: VariacaoDimensao[];
  mudouPerfil: boolean;
  /** Pontuação atual - pontuação anterior. */
  deltaPontuacao: number;
  /** "O que mudou", em uma ou duas frases. */
  resumo: string;
}

export type MotivoSemEvolucao = "anonimo" | "primeira-analise" | "versao-diferente" | "indisponivel";

export interface Reavaliacao {
  /** Data (ISO) da análise mais recente da conta. */
  ultimaAnalise: string;
}

export interface Relatorio {
  /** conta: análise guardada na conta · atual: resultado que acabou de sair (anônimo, ou conta sem gravação). */
  origem: "conta" | "atual";
  perfil: Profile;
  pontuacao: number;
  /** Data da análise (ISO). */
  criadaEm: string;
  versaoMapeamento: number;
  logado: boolean;
  dimensoes: NotaDimensao[];
  alertas: Alerta[];
  evolucao: Evolucao | null;
  motivoSemEvolucao: MotivoSemEvolucao | null;
  /** Só quando esta é a análise mais recente da conta e tem mais de 12 meses. */
  reavaliacao: Reavaliacao | null;
}

/** O que a leitura da IA recebe: números prontos do sistema. */
export type EntradaLeitura = Pick<Relatorio, "perfil" | "pontuacao" | "dimensoes" | "alertas" | "evolucao">;
