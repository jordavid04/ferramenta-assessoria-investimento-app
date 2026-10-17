import { Pool } from "pg";
import type { Answers, Profile } from "./suitability/scoring.ts";
import type { RecommendationResult } from "./ai/prompt.ts";

let pool: Pool | null = null;

/** Retorna o pool de conexões, ou null se DATABASE_URL não estiver configurada (modo sem persistência). */
function getPool(): Pool | null {
  if (!process.env.DATABASE_URL) return null;
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  return pool;
}

export async function saveSession(input: {
  answers: Answers;
  score: number;
  profile: Profile;
  aiSource: "gemini" | "fallback";
  recommendation: RecommendationResult;
  acceptedTerms: boolean;
}): Promise<string | null> {
  const p = getPool();
  if (!p) return null;
  const { rows } = await p.query<{ id: string }>(
    `INSERT INTO suitability_sessions (answers, score, profile, ai_source, recommendation, accepted_terms)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [JSON.stringify(input.answers), input.score, input.profile, input.aiSource, JSON.stringify(input.recommendation), input.acceptedTerms],
  );
  return rows[0].id;
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
