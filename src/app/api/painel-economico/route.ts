import { getEconomicSnapshot } from "@/lib/economia/snapshot";

export const dynamic = "force-dynamic";

/**
 * Indicadores, histórico e juro real (dados abertos do BCB).
 * Página pública. Falha da fonte não vira erro: o status diz se o dado é recente, guardado ou indisponível.
 */
export async function GET() {
  const snapshot = await getEconomicSnapshot();
  return Response.json(snapshot);
}
