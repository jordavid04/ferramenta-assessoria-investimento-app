import { getCurrentUser } from "@/lib/session";
import { getSimulationReading } from "@/lib/simulador/explicacao";
import { errorResponse, guardInputOf, prepareSimulation } from "@/lib/simulador/servico";

export const dynamic = "force-dynamic";

/**
 * POST /api/simulador/leitura — mesma entrada de /api/simulador.
 * Texto que explica o resultado (IA ou texto local). Separado do cálculo para a IA nunca atrasar os números.
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
    const result = await prepareSimulation(body, user?.id ?? null);
    if (!result.ok) return errorResponse(result);
    const reading = await getSimulationReading(guardInputOf(result.data));
    return Response.json({ reading: reading.text, source: reading.source });
  } catch (err) {
    console.error("[Simulador]", err);
    return Response.json({ error: "Não foi possível gerar a leitura da simulação agora." }, { status: 500 });
  }
}
