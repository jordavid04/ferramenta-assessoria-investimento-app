import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** GET /api/auth/me — { user } ou { user: null } quando não há sessão. */
export async function GET() {
  const user = await getCurrentUser();
  return Response.json({ user });
}
