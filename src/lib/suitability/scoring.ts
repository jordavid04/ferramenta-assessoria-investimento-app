import { QUESTIONS, type OptionKey } from "./questions.ts";

export type Profile = "Conservador" | "Moderado" | "Arrojado" | "Agressivo";
/** Respostas indexadas pelo id da questão (1..18). */
export type Answers = Record<number, OptionKey>;

export const POINTS: Record<OptionKey, number> = { A: 1, B: 2, C: 3, D: 4 };
export const MIN_SCORE = QUESTIONS.length * 1; // 18
export const MAX_SCORE = QUESTIONS.length * 4; // 72

/** Faixas de classificação definidas no Apêndice do Checkpoint 1. */
export const PROFILE_RANGES: { profile: Profile; min: number; max: number }[] = [
  { profile: "Conservador", min: 18, max: 32 },
  { profile: "Moderado", min: 33, max: 50 },
  { profile: "Arrojado", min: 51, max: 62 },
  { profile: "Agressivo", min: 63, max: 72 },
];

export function isComplete(answers: Partial<Answers>): answers is Answers {
  return QUESTIONS.every((q) => answers[q.id] !== undefined);
}

export function calculateScore(answers: Answers): number {
  return QUESTIONS.reduce((sum, q) => {
    const a = answers[q.id];
    if (!a || !(a in POINTS)) {
      throw new Error(`Resposta ausente ou inválida para a questão ${q.id}`);
    }
    return sum + POINTS[a];
  }, 0);
}

export function classifyProfile(score: number): Profile {
  const range = PROFILE_RANGES.find((r) => score >= r.min && score <= r.max);
  if (!range) throw new Error(`Pontuação fora do intervalo ${MIN_SCORE}-${MAX_SCORE}: ${score}`);
  return range.profile;
}

export function evaluate(answers: Answers): { score: number; profile: Profile } {
  const score = calculateScore(answers);
  return { score, profile: classifyProfile(score) };
}
