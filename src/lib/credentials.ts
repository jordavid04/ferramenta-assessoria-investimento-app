const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

/** Devolve o nome em minúsculas, ou null se o formato não servir para login. */
export function normalizeUsername(raw: string): string | null {
  const username = raw.trim().toLowerCase();
  if (!USERNAME_RE.test(username)) return null;
  return username;
}

/** null quando a senha está no intervalo aceito (8 a 72 caracteres). */
export function passwordError(password: string): string | null {
  if (password.length < 8 || password.length > 72) {
    return "A senha precisa ter entre 8 e 72 caracteres.";
  }
  return null;
}
