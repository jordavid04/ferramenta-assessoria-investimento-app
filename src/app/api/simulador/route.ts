import { getCurrentUser } from "@/lib/session";
import { errorResponse, prepareSimulation } from "@/lib/simulador/servico";
import { resolvePerfil } from "@/lib/simulador/perfil";

export const dynamic = "force-dynamic";

async function currentUserId(): Promise<string | null> {
  try {
    return (await getCurrentUser())?.id ?? null;
  } catch (err) {
    // Problema com a sessão não pode impedir a simulação: segue como anônimo.
    console.warn("[Simulador] não foi possível ler a sessão; seguindo como anônimo", err instanceof Error ? err.message : err);
    return null;
  }
}

/** GET /api/simulador — de onde virá o perfil (análise da conta ou perfil de exemplo). Não calcula nada. */
export async function GET() {
  try {
    const userId = await currentUserId();
    // Sem perfil de exemplo: se a conta tem análise ela vem resolvida; senão volta "pendente".
    const perfil = await resolvePerfil(userId, null);
    return Response.json({ loggedIn: userId !== null, perfil });
  } catch (err) {
    console.error("[Simulador]", err);
    return Response.json({ error: "Não foi possível carregar o simulador agora." }, { status: 500 });
  }
}

/**
 * POST /api/simulador
 * body: { initial, monthly, years, goal?, profile? }  (profile = perfil de exemplo; ignorado se a conta tem análise)
 * Devolve só números calculados pelo sistema; a leitura da IA vem de /api/simulador/leitura.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  try {
    const result = await prepareSimulation(body, await currentUserId());
    if (!result.ok) return errorResponse(result);
    return Response.json(result.data);
  } catch (err) {
    console.error("[Simulador]", err);
    return Response.json({ error: "Não foi possível calcular a simulação agora." }, { status: 500 });
  }
}
