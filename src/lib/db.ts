import { Pool } from "pg";
import type { RecommendationResult } from "./ai/prompt.ts";
import type { Answers, Profile } from "./suitability/scoring.ts";

let pool: Pool | null = null;

/** Retorna o pool de conexões, ou null se DATABASE_URL não estiver configurada (modo sem persistência). */
function getPool(): Pool | null {
  if (!process.env.DATABASE_URL) return null;
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  return pool;
}

export class DatabaseDisabledError extends Error {
  constructor() {
    super("Banco de dados indisponível.");
    this.name = "DatabaseDisabledError";
  }
}

export class UsernameTakenError extends Error {
  constructor() {
    super("Este nome de usuário já está em uso.");
    this.name = "UsernameTakenError";
  }
}

function requirePool(): Pool {
  const p = getPool();
  if (!p) throw new DatabaseDisabledError();
  return p;
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505";
}

export type UserRecord = {
  id: string;
  username: string;
  passwordHash: string;
};

export async function createUser(username: string, passwordHash: string): Promise<{ id: string; username: string }> {
  const p = requirePool();
  try {
    const { rows } = await p.query<{ id: string; username: string }>(
      `INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username`,
      [username, passwordHash],
    );
    return rows[0];
  } catch (err) {
    if (isUniqueViolation(err)) throw new UsernameTakenError();
    throw err;
  }
}

export async function findUserByUsername(username: string): Promise<UserRecord | null> {
  const p = requirePool();
  const { rows } = await p.query<{ id: string; username: string; password_hash: string }>(
    `SELECT id, username, password_hash FROM users WHERE username = $1`,
    [username],
  );
  const row = rows[0];
  if (!row) return null;
  return { id: row.id, username: row.username, passwordHash: row.password_hash };
}

export async function saveSession(input: {
  answers: Answers;
  score: number;
  profile: Profile;
  aiSource: "gemini" | "fallback";
  recommendation: RecommendationResult;
  acceptedTerms: boolean;
  userId: string | null;
}): Promise<string | null> {
  const p = getPool();
  if (!p) return null;
  const { rows } = await p.query<{ id: string }>(
    `INSERT INTO suitability_sessions (answers, score, profile, ai_source, recommendation, accepted_terms, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [
      JSON.stringify(input.answers),
      input.score,
      input.profile,
      input.aiSource,
      JSON.stringify(input.recommendation),
      input.acceptedTerms,
      input.userId,
    ],
  );
  return rows[0].id;
}

export type SessionSummary = {
  id: string;
  createdAt: string;
  score: number;
  profile: Profile;
};

export async function listSessionsByUser(userId: string): Promise<SessionSummary[]> {
  const p = requirePool();
  const { rows } = await p.query<{ id: string; created_at: Date; score: number; profile: Profile }>(
    `SELECT id, created_at, score, profile
     FROM suitability_sessions
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId],
  );
  return rows.map((row) => ({
    id: row.id,
    createdAt: new Date(row.created_at).toISOString(),
    score: row.score,
    profile: row.profile,
  }));
}

/** Análise mais recente da conta (para o painel econômico). */
export async function getLatestSessionSummary(userId: string): Promise<SessionSummary | null> {
  const p = requirePool();
  const { rows } = await p.query<{ id: string; created_at: Date; score: number; profile: Profile }>(
    `SELECT id, created_at, score, profile
     FROM suitability_sessions
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId],
  );
  const row = rows[0];
  if (!row) return null;
  return { id: row.id, createdAt: new Date(row.created_at).toISOString(), score: row.score, profile: row.profile };
}

/* ---------- Cache do painel econômico (dados do BCB e leituras da IA) ---------- */

export type EconomicIndicatorRow = { indicator: string; points: unknown; fetchedAt: string };

export async function listEconomicIndicatorRows(): Promise<EconomicIndicatorRow[]> {
  const p = requirePool();
  const { rows } = await p.query<{ indicator: string; points: unknown; fetched_at: Date }>(
    `SELECT indicator, points, fetched_at FROM economic_indicators`,
  );
  return rows.map((r) => ({ indicator: r.indicator, points: r.points, fetchedAt: new Date(r.fetched_at).toISOString() }));
}

export async function saveEconomicIndicatorRow(indicator: string, points: unknown, fetchedAt: string): Promise<void> {
  const p = requirePool();
  await p.query(
    `INSERT INTO economic_indicators (indicator, points, fetched_at) VALUES ($1, $2, $3)
     ON CONFLICT (indicator) DO UPDATE SET points = EXCLUDED.points, fetched_at = EXCLUDED.fetched_at`,
    [indicator, JSON.stringify(points), fetchedAt],
  );
}

export type EconomicInsightRow = { payload: unknown; createdAt: string };

export async function getEconomicInsightRow(cacheKey: string): Promise<EconomicInsightRow | null> {
  const p = requirePool();
  const { rows } = await p.query<{ payload: unknown; created_at: Date }>(
    `SELECT payload, created_at FROM economic_insights WHERE cache_key = $1`,
    [cacheKey],
  );
  const row = rows[0];
  return row ? { payload: row.payload, createdAt: new Date(row.created_at).toISOString() } : null;
}

export async function saveEconomicInsightRow(cacheKey: string, payload: unknown): Promise<void> {
  const p = requirePool();
  await p.query(
    `INSERT INTO economic_insights (cache_key, payload, created_at) VALUES ($1, $2, now())
     ON CONFLICT (cache_key) DO UPDATE SET payload = EXCLUDED.payload, created_at = now()`,
    [cacheKey, JSON.stringify(payload)],
  );
}

export type StoredSession = {
  id: string;
  score: number;
  profile: Profile;
  source: "gemini" | "fallback";
  recommendation: RecommendationResult;
};

export async function getSessionForUser(id: string, userId: string): Promise<StoredSession | null> {
  const p = requirePool();
  const { rows } = await p.query<{
    id: string;
    score: number;
    profile: Profile;
    ai_source: "gemini" | "fallback";
    recommendation: RecommendationResult;
  }>(
    `SELECT id, score, profile, ai_source, recommendation
     FROM suitability_sessions
     WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    score: row.score,
    profile: row.profile,
    source: row.ai_source,
    recommendation: row.recommendation,
  };
}

export async function dbHealth(): Promise<"ok" | "disabled" | "error"> {
  const p = getPool();
  if (!p) return "disabled";
  try {
    await p.query("SELECT 1");
    return "ok";
  } catch {
    return "error";
  }
}
