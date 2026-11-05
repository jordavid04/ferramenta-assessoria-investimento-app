import { jsonAuthError } from "@/lib/api-error";
import { listSimulationsByUser, saveSimulation } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { getSimulationReading } from "@/lib/simulador/explicacao";
import { errorResponse, guardInputOf, prepareSimulation } from "@/lib/simulador/servico";

export const dynamic = "force-dynamic";

/** GET /api/simulador/salvas — simulações da conta logada, da mais recente para a mais antiga. */
export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return Response.json({ error: "Entre na sua conta para ver as simulações." }, { status: 401 });
  }
  try {
    const simulations = await listSimulationsByUser(user.id);
    return Response.json({ simulations });
  } catch (err) {
    return jsonAuthError(err);
  }
}

/**
 * POST /api/simulador/salvas — mesma entrada de /api/simulador. O servidor recalcula tudo;
 * o cliente não envia (nem o servidor aceita) resultado pronto. Só para quem está logado.
 * Se a gravação falhar, o erro é registrado e a resposta traz `id: null`: o usuário continua vendo o resultado.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    return Response.json({ error: "Entre na sua conta para salvar a simulação." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  try {
    const result = await prepareSimulation(body, user.id);
    if (!result.ok) return errorResponse(result);
    const { data } = result;
    const reading = await getSimulationReading(guardInputOf(data));

    let id: string | null = null;
    try {
      id = await saveSimulation({
        userId: user.id,
        profile: data.perfil.profile,
        profileOrigin: data.perfil.origem,
        input: data.projection.input,
        allocation: data.perfil.allocation,
        rates: data.rates,
        result: data.projection,
        aiSource: reading.source,
        reading: reading.text,
      });
    } catch (err) {
      console.error("Falha ao persistir simulação:", err); // não bloqueia o usuário
    }
    return Response.json({ id });
  } catch (err) {
    console.error("[Simulador]", err);
    return Response.json({ error: "Não foi possível salvar a simulação agora." }, { status: 500 });
  }
}
