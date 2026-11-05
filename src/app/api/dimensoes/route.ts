import { montarRelatorio, respostaSemRelatorio } from "@/lib/dimensoes/servico";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/dimensoes — body: { id?: string, answers?: {"1":"A",...,"18":"D"} }
 * Perfil multidimensional (notas por dimensão, alertas de coerência, evolução e lembrete de reavaliação).
 * - `id` de uma análise da conta logada: usa as respostas guardadas (análises antigas ganham as dimensões);
 * - `answers`: resultado atual (anônimo, ou conta cuja gravação falhou);
 * - `id` anônimo ou de outra conta, sem `answers`: 404.
 * Só informativo: não altera perfil, pontuação nem alocação, e o cálculo não depende da IA.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  try {
    const user = await getCurrentUser().catch(() => null);
    const result = await montarRelatorio(body, user?.id ?? null);
    if (result.status !== "ok") return respostaSemRelatorio(result);
    return Response.json({ status: "ok", relatorio: result.relatorio });
  } catch (err) {
    console.error("[Dimensões]", err);
    return Response.json({ error: "Não foi possível calcular as dimensões agora." }, { status: 500 });
  }
}
