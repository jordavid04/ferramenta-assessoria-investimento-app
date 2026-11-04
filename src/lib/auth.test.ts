import assert from "node:assert/strict";
import { test } from "node:test";
import { hashPassword, signSession, verifyPassword, verifySession } from "./auth.ts";
import { normalizeUsername, passwordError } from "./credentials.ts";

test("normaliza o nome de usuário e recusa formato inválido", () => {
  assert.equal(normalizeUsername("  Ana_01 "), "ana_01");
  assert.equal(normalizeUsername("ab"), null);
  assert.equal(normalizeUsername("com espaço"), null);
  assert.equal(normalizeUsername("nome@email"), null);
});

test("senha precisa ter entre 8 e 72 caracteres", () => {
  assert.equal(passwordError("curta"), "A senha precisa ter entre 8 e 72 caracteres.");
  assert.equal(passwordError("a".repeat(73)), "A senha precisa ter entre 8 e 72 caracteres.");
  assert.equal(passwordError("senha-ok-123"), null);
});

test("scrypt confere a senha certa e rejeita a errada", async () => {
  const hash = await hashPassword("senha-ok-123");
  assert.equal(await verifyPassword("senha-ok-123", hash), true);
  assert.equal(await verifyPassword("outra-senha", hash), false);
  assert.equal(await verifyPassword("senha-ok-123", "lixo"), false);
});

test("JWT faz a ida e a volta do usuário", async () => {
  process.env.JWT_SECRET = "segredo-de-teste-123";
  const token = await signSession({
    id: "11111111-1111-1111-1111-111111111111",
    username: "ana",
  });
  assert.deepEqual(await verifySession(token), {
    id: "11111111-1111-1111-1111-111111111111",
    username: "ana",
  });
  await assert.rejects(() => verifySession("nao.e.jwt"));
});
