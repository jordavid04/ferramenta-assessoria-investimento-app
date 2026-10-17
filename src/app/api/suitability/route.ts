import { getRecommendation } from "@/lib/ai/gemini";
import { saveSession } from "@/lib/db";
import { QUESTIONS } from "@/lib/suitability/questions";
import { evaluate, isComplete, type Answers } from "@/lib/suitability/scoring";

export const dynamic = "force-dynamic";

/**
 * POST /api/suitability
 * body: { answers: {"1":"A",...,"18":"D"}, acceptedTerms: true }
 * O perfil é SEMPRE calculado no servidor (regra ANBIMA); a IA só explica e sugere.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { answers: raw, acceptedTerms } = (body ?? {}) as { answers?: Record<string, unknown>; acceptedTerms?: unknown };
  if (acceptedTerms !== true) {
    return Response.json({ error: "É necessário aceitar os termos para continuar." }, { status: 400 });
  }
  if (!raw || typeof raw !== "object") {
    return Response.json({ error: "Campo 'answers' ausente." }, { status: 400 });
  }

  const answers: Partial<Answers> = {};
  for (const q of QUESTIONS) {
    const v = raw[String(q.id)];
    if (v === "A" || v === "B" || v === "C" || v === "D") answers[q.id] = v;
  }
  if (!isComplete(answers)) {
    return Response.json({ error: "Responda todas as 18 questões." }, { status: 422 });
  }

  const { score, profile } = evaluate(answers);
  const { result, source, fallbackReason } = await getRecommendation(answers, score, profile);

  let id: string | null = null;
  try {
    id = await saveSession({ answers, score, profile, aiSource: source, recommendation: result, acceptedTerms: true });
  } catch (err) {
    console.error("Falha ao persistir sessão:", err); // não bloqueia o usuário
  }

  return Response.json({ id, score, profile, source, fallbackReason, recommendation: result });
}
