import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { SignJWT, jwtVerify } from "jose";

const scrypt = promisify(scryptCallback);
const KEYLEN = 64;

export type SessionUser = { id: string; username: string };

export class AuthConfigError extends Error {
  constructor() {
    super("Autenticação indisponível: defina JWT_SECRET.");
    this.name = "AuthConfigError";
  }
}

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) throw new AuthConfigError();
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, KEYLEN)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, salt, hex] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hex) return false;
  const derived = (await scrypt(password, salt, KEYLEN)) as Buffer;
  const expected = Buffer.from(hex, "hex");
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(derived, expected);
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ username: user.username })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function verifySession(token: string): Promise<SessionUser> {
  const { payload } = await jwtVerify(token, secretKey());
  if (!payload.sub || typeof payload.username !== "string") {
    throw new Error("Token sem usuário.");
  }
  return { id: payload.sub, username: payload.username };
}
