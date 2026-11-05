/**
 * Verificação do texto da IA antes de ele aparecer na leitura do perfil multidimensional.
 * Descarta promessa/certeza de ganho, linguagem de recomendação, ativos específicos, números diferentes dos
 * calculados, afirmação de que o perfil deveria ser outro e afirmações sobre coerência que contradigam os
 * alertas. Descartado → entra o texto local (modo offline).
 *
 * A checagem de números e de alertas é exata; a de "alto/baixo" por dimensão é uma heurística (só olha frases
 * que citam UMA dimensão). O pior caso de um falso positivo é aparecer o texto local, que é seguro.
 */
import { checkForbiddenLanguage, checkProfileMention } from "../economia/content-guard.ts";
import { MAX_SCORE } from "../suitability/scoring.ts";
import { DIMENSION_ORDER, type DimensionId } from "./mapeamento.ts";
import type { EntradaLeitura } from "./tipos.ts";

export const MAX_LEITURA_LENGTH = 1500;

const L = "\\p{L}\\p{N}";
/** Palavra inteira (\b do JS não entende acentos). */
const word = (alternatives: string) => new RegExp(`(?<![${L}])(?:${alternatives})(?![${L}])`, "iu");

/** Futuro do indicativo e certezas que soam como promessa. */
const CERTEZA = word("vai (?:ter|chegar|alcançar|acumular|conseguir|obter|ganhar|atingir)|vão (?:ter|chegar|alcançar)|terá|terão|chegará|alcançará|ganhará|sem dúvida|com certeza");

/** Afirmar que o perfil deveria ser outro (o perfil é calculado pelo sistema e a IA não o discute). */
const OUTRO_PERFIL: RegExp[] = [
  word("(?:deveria|devia|poderia)\\s+(?:ser|estar)\\s+(?:um\\s+|o\\s+)?(?:perfil\\s+)?(?:mais\\s+)?(?:conservador|moderado|arrojado|agressivo)"),
  word("perfil\\s+(?:real|verdadeiro|correto)"),
  word("mais\\s+adequad[oa]s?"),
  word("reclassific\\p{L}*|(?:mudar|trocar|migrar)\\s+(?:de|para)\\s+(?:o\\s+)?perfil|na verdade (?:você|voce) (?:é|e)"),
  word("perfil\\s+mais\\s+(?:conservador|moderado|arrojado|agressivo)"),
];

const TEMA_COERENCIA = "inconsist\\p{L}*|contradi\\p{L}*|incoer\\p{L}*|alertas?";
/** "Não há inconsistências", "sem alertas": só vale quando o sistema não encontrou nada. */
const NEGA_ALERTA: RegExp[] = [
  word(`(?:nenhum[a]?|sem|ausência de)\\s+(?:\\p{L}+\\s+){0,2}(?:${TEMA_COERENCIA})`),
  word(`não\\s+(?:há|existe\\p{L}*|encontr\\p{L}+|identific\\p{L}+|aparece\\p{L}*)\\s+(?:\\p{L}+\\s+){0,3}(?:${TEMA_COERENCIA})`),
  word("(?:totalmente|completamente|perfeitamente|plenamente)\\s+coerentes?"),
  word("(?:respostas|dimensões)\\s+(?:são|estão|parecem)\\s+(?:\\p{L}+\\s+)?coerentes"),
];
/** Falar de inconsistência, contradição ou alerta (sem negar) quando o sistema não encontrou nenhum. */
const FALA_DE_ALERTA = word(TEMA_COERENCIA);
const NEGACAO = word("não|nenhum[a]?|sem|ausência");

const PALAVRAS_DIMENSAO: Record<DimensionId, RegExp> = {
  tolerancia: word("toler\\p{L}*|oscila\\p{L}*"),
  horizonte: word("horizonte|prazos?"),
  conhecimento: word("conhecimento|experi\\p{L}+|familiaridade"),
  situacao: word("situação financeira|capacidade financeira"),
  objetivo: word("objetivos?"),
};
const PALAVRA_ALTA = word("alt[ao]s?|elevad[ao]s?|fortes?|longos?|longas?|grandes?|bo[ma]s?|bons|maior(?:es)?");
const PALAVRA_BAIXA = word("baix[ao]s?|pequen[ao]s?|fraco|fraca|limitad[ao]s?|curt[ao]s?|pouc[ao]s?|menor(?:es)?|reduzid[ao]s?");

/** Todo número que aparece no texto precisa ser um dos fornecidos pelo sistema. */
export function numerosPermitidos(e: EntradaLeitura): Set<number> {
  const nums = new Set<number>([0, 100, MAX_SCORE, 18, 12, e.pontuacao, e.dimensoes.length, e.alertas.length]);
  for (const d of e.dimensoes) {
    nums.add(d.nota);
    nums.add(d.perguntas);
  }
  if (e.evolucao) {
    nums.add(e.evolucao.anterior.pontuacao);
    nums.add(Math.abs(e.evolucao.deltaPontuacao));
    for (const v of e.evolucao.variacoes) {
      nums.add(v.de);
      nums.add(v.para);
      nums.add(Math.abs(v.delta));
    }
  }
  // Números que aparecem nas frases entregues à IA (por exemplo "3 anos" ou "15%" nos textos dos alertas).
  const frases = [...e.dimensoes.map((d) => `${d.resumo} ${d.detalhe ?? ""}`), ...e.alertas.map((a) => `${a.texto} ${a.reflexao}`)];
  for (const f of frases) for (const m of f.matchAll(/\d+/g)) nums.add(Number(m[0]));
  return nums;
}

const NUMERO = /\d+(?:[.,]\d+)?/g;

function sentencas(texto: string): string[] {
  return texto.split(/(?<=[.!?;:])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
}

/** Motivos pelos quais o texto não pode ser exibido (lista vazia = texto aceito). */
export function checarLeitura(texto: string, e: EntradaLeitura): string[] {
  const motivos = new Set<string>();
  const t = texto.trim();
  if (t.length === 0) return ["texto vazio"];
  if (t.length > MAX_LEITURA_LENGTH) motivos.add("texto longo demais");

  for (const m of checkForbiddenLanguage(texto)) motivos.add(m);
  if (CERTEZA.test(texto)) motivos.add("promessa de ganho (linguagem de certeza)");
  for (const m of checkProfileMention(texto, e.perfil)) motivos.add(m);
  if (OUTRO_PERFIL.some((re) => re.test(texto))) motivos.add("afirma que o perfil deveria ser outro");

  const permitidos = numerosPermitidos(e);
  for (const m of texto.matchAll(NUMERO)) {
    const n = Number(m[0].replace(",", "."));
    if (!permitidos.has(n)) motivos.add(`número que o sistema não forneceu (${m[0]})`);
  }

  if (e.alertas.length > 0) {
    if (NEGA_ALERTA.some((re) => re.test(texto))) motivos.add("diz que não há inconsistências, mas o sistema encontrou alertas");
  } else {
    for (const s of sentencas(texto)) {
      if (FALA_DE_ALERTA.test(s) && !NEGACAO.test(s)) {
        motivos.add("fala de inconsistência ou alerta, mas o sistema não encontrou nenhum");
        break;
      }
    }
  }

  for (const s of sentencas(texto)) {
    const citadas = DIMENSION_ORDER.filter((id) => PALAVRAS_DIMENSAO[id].test(s));
    if (citadas.length !== 1) continue; // frases com várias dimensões são ambíguas: não julgamos
    const dim = e.dimensoes.find((d) => d.id === citadas[0]);
    if (!dim) continue;
    const alta = PALAVRA_ALTA.test(s);
    const baixa = PALAVRA_BAIXA.test(s);
    if (dim.faixa === "alta" && baixa && !alta) motivos.add(`contradiz a faixa calculada de "${dim.nome}"`);
    if (dim.faixa === "baixa" && alta && !baixa) motivos.add(`contradiz a faixa calculada de "${dim.nome}"`);
  }
  return [...motivos];
}
