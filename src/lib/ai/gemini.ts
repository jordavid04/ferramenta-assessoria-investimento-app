import type { Answers, Profile } from "../suitability/scoring.ts";
import { allocationSum, BASE_ALLOCATION } from "./allocation.ts";
import { fallbackRecommendation } from "./fallback.ts";
import { buildPrompt, DISCLAIMER, type RecommendationResult } from "./prompt.ts";

const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const isNum = (v: unknown, min: number, max: number): v is number => typeof v === "number" && v >= min && v <= max;

/** Valida o JSON devolvido pela IA (não confiamos no formato: lança erro se estiver fora do contrato). */
export function parseResult(raw: unknown): RecommendationResult {
  const r = raw as Partial<RecommendationResult> | null;
  const ok =
    !!r &&
    isStr(r.profileExplanation) &&
    Array.isArray(r.allocation) && r.allocation.length >= 3 &&
    r.allocation.every((a) => isStr(a?.assetClass) && isNum(a?.percent, 0, 100) && isStr(a?.rationale)) &&
    Array.isArray(r.suggestions) && r.suggestions.length >= 1 &&
    r.suggestions.every((s) => isStr(s?.assetClass) && isStr(s?.title) && isStr(s?.description) && isNum(s?.compatibility, 0, 100)) &&
    Array.isArray(r.educationalTips) && r.educationalTips.length >= 1 && r.educationalTips.every(isStr);
  if (!ok) throw new Error("JSON da IA fora do contrato esperado");
  return { ...(r as RecommendationResult), disclaimer: DISCLAIMER };
}

/** Garante que a IA respeitou as regras: soma 100 e desvio máx. de 10 p.p. da alocação-base. */
export function validateAllocation(result: RecommendationResult, profile: Profile): boolean {
  if (Math.round(allocationSum(result.allocation)) !== 100) return false;
  return result.allocation.every((a) => {
    const base = BASE_ALLOCATION[profile].find((b) => b.assetClass === a.assetClass);
    return base !== undefined && Math.abs(base.percent - a.percent) <= 10;
  });
}

export interface RecommendationOutcome {
  result: RecommendationResult;
  source: "gemini" | "fallback";
  fallbackReason?: string;
}

export async function getRecommendation(answers: Answers, score: number, profile: Profile): Promise<RecommendationOutcome> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { result: fallbackRecommendation(profile), source: "fallback", fallbackReason: "GEMINI_API_KEY não configurada" };
  }

  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildPrompt(answers, score, profile) }] }],
        generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Gemini respondeu HTTP ${res.status}`);

    const payload = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    const result = parseResult(JSON.parse(text));

    if (!validateAllocation(result, profile)) throw new Error("Alocação retornada pela IA violou as regras de validação");
    return { result, source: "gemini" };
  } catch (err) {
    return {
      result: fallbackRecommendation(profile),
      source: "fallback",
      fallbackReason: err instanceof Error ? err.message : "erro desconhecido",
    };
  }
}
