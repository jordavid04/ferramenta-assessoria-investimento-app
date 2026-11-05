import { jsonAuthError } from "@/lib/api-error";
import { getSimulationForUser } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /api/simulador/salvas/:id — só a simulação do usuário logado. Anônima, de outra conta ou id inválido: 404. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) {
    return Response.json({ error: "Simulação não encontrada." }, { status: 404 });
  }

  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return Response.json({ error: "Entre na sua conta para ver esta simulação." }, { status: 401 });
  }

  try {
    const simulation = await getSimulationForUser(id, user.id);
    if (!simulation) return Response.json({ error: "Simulação não encontrada." }, { status: 404 });
    return Response.json(simulation);
  } catch (err) {
    return jsonAuthError(err);
  }
}
