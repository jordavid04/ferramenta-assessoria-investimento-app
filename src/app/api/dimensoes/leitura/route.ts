import { getLeituraDoPerfil } from "@/lib/dimensoes/leitura";
import { montarRelatorio, respostaSemRelatorio } from "@/lib/dimensoes/servico";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/dimensoes/leitura — mesma entrada de /api/dimensoes.
 * Texto que explica o conjunto (IA ou texto local). Separado do cálculo para a IA nunca atrasar o radar.
 * A IA recebe os números prontos e só os explica; o texto passa por verificação antes de sair.
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
    const leitura = await getLeituraDoPerfil(result.relatorio);
    return Response.json({ status: "ok", reading: leitura.text, source: leitura.source });
  } catch (err) {
    console.error("[Dimensões]", err);
    return Response.json({ error: "Não foi possível gerar a leitura agora." }, { status: 500 });
  }
}
