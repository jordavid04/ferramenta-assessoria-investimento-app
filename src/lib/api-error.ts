import { AuthConfigError } from "./auth.ts";
import { DatabaseDisabledError, UsernameTakenError } from "./db.ts";

/** Resposta JSON para falhas de conta que não são "senha errada". */
export function jsonAuthError(err: unknown): Response {
  if (err instanceof UsernameTakenError) {
    return Response.json({ error: err.message }, { status: 409 });
  }
  if (err instanceof DatabaseDisabledError) {
    return Response.json(
      { error: "Banco de dados indisponível. Sem ele não dá para entrar na conta." },
      { status: 503 },
    );
  }
  if (err instanceof AuthConfigError) {
    return Response.json({ error: err.message }, { status: 500 });
  }
  console.error(err);
  return Response.json({ error: "Não foi possível concluir a operação." }, { status: 500 });
}
