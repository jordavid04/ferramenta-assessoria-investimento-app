import { jsonAuthError } from "@/lib/api-error";
import { getSessionForUser } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /api/suitability/:id — só a análise do usuário logado. Anônima ou de outra conta responde 404. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) {
    return Response.json({ error: "Análise não encontrada." }, { status: 404 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Entre na sua conta para ver esta análise." }, { status: 401 });
  }

  try {
    const session = await getSessionForUser(id, user.id);
    if (!session) return Response.json({ error: "Análise não encontrada." }, { status: 404 });
    return Response.json(session);
  } catch (err) {
    return jsonAuthError(err);
  }
}
