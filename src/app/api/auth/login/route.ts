import { jsonAuthError } from "@/lib/api-error";
import { signSession, verifyPassword } from "@/lib/auth";
import { normalizeUsername } from "@/lib/credentials";
import { findUserByUsername } from "@/lib/db";
import { setSessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

const INVALID = "Usuário ou senha inválidos.";

/**
 * POST /api/auth/login
 * body: { username, password }
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { username: rawUsername, password } = (body ?? {}) as { username?: unknown; password?: unknown };
  const username = typeof rawUsername === "string" ? normalizeUsername(rawUsername) : null;
  if (!username || typeof password !== "string" || password.length === 0) {
    return Response.json({ error: INVALID }, { status: 401 });
  }

  try {
    const found = await findUserByUsername(username);
    if (!found || !(await verifyPassword(password, found.passwordHash))) {
      return Response.json({ error: INVALID }, { status: 401 });
    }
    const user = { id: found.id, username: found.username };
    await setSessionCookie(await signSession(user));
    return Response.json({ user });
  } catch (err) {
    return jsonAuthError(err);
  }
}
