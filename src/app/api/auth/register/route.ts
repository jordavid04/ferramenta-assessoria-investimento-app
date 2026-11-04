import { jsonAuthError } from "@/lib/api-error";
import { hashPassword, signSession } from "@/lib/auth";
import { normalizeUsername, passwordError } from "@/lib/credentials";
import { createUser } from "@/lib/db";
import { setSessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/register
 * body: { username, password }
 * Cria a conta e grava o JWT em cookie httpOnly.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { username: rawUsername, password } = (body ?? {}) as { username?: unknown; password?: unknown };
  if (typeof rawUsername !== "string" || typeof password !== "string") {
    return Response.json({ error: "Informe nome de usuário e senha." }, { status: 400 });
  }

  const username = normalizeUsername(rawUsername);
  if (!username) {
    return Response.json(
      { error: "Use de 3 a 32 caracteres: letras, números, ponto, hífen ou underline." },
      { status: 400 },
    );
  }
  const pw = passwordError(password);
  if (pw) return Response.json({ error: pw }, { status: 400 });

  try {
    const user = await createUser(username, await hashPassword(password));
    await setSessionCookie(await signSession(user));
    return Response.json({ user });
  } catch (err) {
    return jsonAuthError(err);
  }
}
