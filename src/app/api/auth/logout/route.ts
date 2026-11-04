import { clearSessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

/** POST /api/auth/logout — apaga o cookie da sessão. */
export async function POST() {
  await clearSessionCookie();
  return Response.json({ ok: true });
}
