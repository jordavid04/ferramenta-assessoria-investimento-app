import { buildLeitura } from "@/lib/economia/leitura";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Leitura do cenário (IA ou texto local). Personalizada para quem está logado e tem análise; geral para os demais. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    const leitura = await buildLeitura(user?.id ?? null);
    return Response.json(leitura);
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Não foi possível gerar a leitura do cenário agora." }, { status: 500 });
  }
}
