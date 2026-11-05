/**
 * Monta o relatório multidimensional de uma análise: resolve de onde vêm as respostas (conta ou resultado
 * atual), calcula dimensões e alertas, compara com a análise anterior e avalia o lembrete de reavaliação.
 *
 * Só LÊ dados. Nunca recalcula nem altera perfil, pontuação ou alocação (a pontuação/perfil de uma análise
 * guardada é a que está no banco). Qualquer falha de leitura de histórico vira "sem evolução" ou
 * "indisponível", nunca uma exceção para quem chama.
 */
import { getLatestSessionSummary, getSessionWithAnswersForUser, listRecentSessionsWithAnswers } from "../db.ts";
import { evaluate, type Answers, type Profile } from "../suitability/scoring.ts";
import { analisar, calcularNotas, lerRespostas } from "./calculo.ts";
import { compararAnalises, precisaReavaliar } from "./evolucao.ts";
import { escolherMapeamento, MAPEAMENTOS, type Mapeamento } from "./mapeamento.ts";
import type { Evolucao, MotivoSemEvolucao, Reavaliacao, Relatorio } from "./tipos.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DB_TIMEOUT_MS = 5_000;
/** Quantas análises anteriores olhar para achar uma com respostas completas. */
const ANALISES_RECENTES = 10;

export const MSG_INCOMPLETA =
  "Esta análise foi feita antes das dimensões e não tem todas as respostas guardadas, por isso não é possível mostrá-las.";
export const MSG_CONSULTA = "Não foi possível consultar esta análise agora. Tente de novo em instantes.";

export interface ServicoDeps {
  getSession?: typeof getSessionWithAnswersForUser;
  listRecent?: typeof listRecentSessionsWithAnswers;
  getLatest?: typeof getLatestSessionSummary;
  now?: () => Date;
  mapeamentos?: Mapeamento[];
}

export type ResultadoRelatorio =
  | { status: "ok"; relatorio: Relatorio }
  /** A análise existe, mas as dimensões não podem ser mostradas (respostas incompletas ou banco fora do ar). */
  | { status: "indisponivel"; motivo: string }
  | { status: "nao-encontrada" }
  | { status: "invalida"; erro: string };

interface Alvo {
  origem: Relatorio["origem"];
  id: string | null;
  createdAt: string;
  pontuacao: number;
  perfil: Profile;
  respostas: Answers;
  mapeamento: Mapeamento;
}

function comTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Banco demorou demais para responder")), DB_TIMEOUT_MS);
    promise.then(
      (v) => (clearTimeout(timer), resolve(v)),
      (e) => (clearTimeout(timer), reject(e)),
    );
  });
}

const aviso = (contexto: string, err: unknown) =>
  console.warn(`[Dimensões] ${contexto}`, err instanceof Error ? err.message : err);

async function buscarEvolucao(
  userId: string,
  alvo: Alvo,
  notasAtuais: ReturnType<typeof calcularNotas>,
  deps: Required<Pick<ServicoDeps, "listRecent" | "mapeamentos">>,
): Promise<{ evolucao: Evolucao | null; motivo: MotivoSemEvolucao | null }> {
  try {
    // Resultado ainda não guardado (origem "atual"): compara com a mais recente da conta.
    const recentes = await comTimeout(deps.listRecent(userId, alvo.origem === "conta" ? alvo.createdAt : null, ANALISES_RECENTES));
    const candidatas = recentes.filter((r) => r.id !== alvo.id);
    if (candidatas.length === 0) return { evolucao: null, motivo: "primeira-analise" };

    let versaoDiferente = false;
    for (const anterior of candidatas) {
      const mapeamento = escolherMapeamento(anterior.createdAt, deps.mapeamentos);
      const respostas = lerRespostas(anterior.answers, mapeamento);
      if (!respostas) continue; // análise antiga sem respostas completas: tenta a anterior a ela
      if (mapeamento.versao !== alvo.mapeamento.versao) {
        versaoDiferente = true; // perguntas mudaram entre as duas: as dimensões podem não ser comparáveis
        break;
      }
      const evolucao = compararAnalises(
        { id: alvo.id ?? "atual", createdAt: alvo.createdAt, pontuacao: alvo.pontuacao, perfil: alvo.perfil, notas: notasAtuais },
        { id: anterior.id, createdAt: anterior.createdAt, pontuacao: anterior.score, perfil: anterior.profile, notas: calcularNotas(respostas, mapeamento) },
      );
      return { evolucao, motivo: null };
    }
    return { evolucao: null, motivo: versaoDiferente ? "versao-diferente" : "indisponivel" };
  } catch (err) {
    aviso("não foi possível ler as análises anteriores; seguindo sem evolução", err);
    return { evolucao: null, motivo: "indisponivel" };
  }
}

async function buscarReavaliacao(
  userId: string,
  alvo: Alvo,
  agora: Date,
  getLatest: NonNullable<ServicoDeps["getLatest"]>,
): Promise<Reavaliacao | null> {
  if (alvo.origem !== "conta") return null; // resultado que acabou de sair não está desatualizado
  try {
    const ultima = await comTimeout(getLatest(userId));
    // O aviso é sobre a análise mais recente da conta: nas antigas, a mais nova já cumpre esse papel.
    return ultima && ultima.id === alvo.id && precisaReavaliar(ultima.createdAt, agora) ? { ultimaAnalise: ultima.createdAt } : null;
  } catch (err) {
    aviso("não foi possível verificar a data da última análise", err);
    return null;
  }
}

/** Resposta HTTP quando não há relatório: 404 (não encontrada), 422 (pedido inválido) ou 200 com o motivo (indisponível). */
export function respostaSemRelatorio(result: Exclude<ResultadoRelatorio, { status: "ok" }>): Response {
  if (result.status === "nao-encontrada") return Response.json({ error: "Análise não encontrada." }, { status: 404 });
  if (result.status === "invalida") return Response.json({ error: result.erro }, { status: 422 });
  return Response.json({ status: "indisponivel", motivo: result.motivo });
}

/**
 * `entrada`: { id?, answers? }.
 * - `id` de uma análise da conta logada → usa as respostas guardadas (histórico: análises antigas ganham as dimensões);
 * - `answers` → resultado atual (anônimo, ou conta cuja gravação falhou), sem depender do banco;
 * - `id` anônimo ou de outra conta, sem `answers` → "nao-encontrada" (não revela se existe).
 */
export async function montarRelatorio(entrada: unknown, userId: string | null, deps: ServicoDeps = {}): Promise<ResultadoRelatorio> {
  const agora = (deps.now ?? (() => new Date()))();
  const mapeamentos = deps.mapeamentos ?? MAPEAMENTOS;
  const getSession = deps.getSession ?? getSessionWithAnswersForUser;
  const listRecent = deps.listRecent ?? listRecentSessionsWithAnswers;
  const getLatest = deps.getLatest ?? getLatestSessionSummary;

  const corpo = (entrada && typeof entrada === "object" ? entrada : {}) as { id?: unknown; answers?: unknown };
  const temId = typeof corpo.id === "string" && corpo.id.length > 0;
  const id = temId && UUID.test(corpo.id as string) ? (corpo.id as string) : null;
  const temRespostas = corpo.answers !== undefined && corpo.answers !== null;
  if (!temId && !temRespostas) return { status: "invalida", erro: "Informe a análise ou as respostas." };

  let alvo: Alvo | null = null;

  if (userId && id) {
    try {
      const guardada = await comTimeout(getSession(id, userId));
      if (guardada) {
        const mapeamento = escolherMapeamento(guardada.createdAt, mapeamentos);
        const respostas = lerRespostas(guardada.answers, mapeamento);
        if (!respostas) return { status: "indisponivel", motivo: MSG_INCOMPLETA };
        alvo = { origem: "conta", id: guardada.id, createdAt: guardada.createdAt, pontuacao: guardada.score, perfil: guardada.profile, respostas, mapeamento };
      }
    } catch (err) {
      aviso("não foi possível ler a análise da conta", err);
      if (!temRespostas) return { status: "indisponivel", motivo: MSG_CONSULTA };
    }
  }

  if (!alvo) {
    if (!temRespostas) return { status: "nao-encontrada" };
    const mapeamento = escolherMapeamento(agora, mapeamentos);
    const respostas = lerRespostas(corpo.answers, mapeamento);
    if (!respostas) return { status: "invalida", erro: "Responda todas as 18 questões." };
    try {
      const { score, profile } = evaluate(respostas);
      alvo = { origem: "atual", id: null, createdAt: agora.toISOString(), pontuacao: score, perfil: profile, respostas, mapeamento };
    } catch {
      return { status: "invalida", erro: "Responda todas as 18 questões." };
    }
  }

  const analise = analisar({ respostas: alvo.respostas, perfil: alvo.perfil, pontuacao: alvo.pontuacao, mapeamento: alvo.mapeamento });

  let evolucao: Evolucao | null = null;
  let motivoSemEvolucao: MotivoSemEvolucao | null = null;
  let reavaliacao: Reavaliacao | null = null;
  if (!userId) {
    motivoSemEvolucao = "anonimo";
  } else {
    const [ev, re] = await Promise.all([
      buscarEvolucao(userId, alvo, analise.notas, { listRecent, mapeamentos }),
      buscarReavaliacao(userId, alvo, agora, getLatest),
    ]);
    evolucao = ev.evolucao;
    motivoSemEvolucao = ev.motivo;
    reavaliacao = re;
  }

  return {
    status: "ok",
    relatorio: {
      origem: alvo.origem,
      perfil: alvo.perfil,
      pontuacao: alvo.pontuacao,
      criadaEm: alvo.createdAt,
      versaoMapeamento: alvo.mapeamento.versao,
      logado: userId !== null,
      dimensoes: analise.dimensoes,
      alertas: analise.alertas,
      evolucao,
      motivoSemEvolucao,
      reavaliacao,
    },
  };
}
