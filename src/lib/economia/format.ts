/** Formatação em pt-BR usada pelo painel (cartões, gráfico e textos locais). */

export function fmtNumber(n: number, digits = 2): string {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}

export function fmtPercent(n: number, digits = 2): string {
  return `${fmtNumber(n, digits)}%`;
}

export function fmtBRL(n: number): string {
  return `R$ ${fmtNumber(n, 2)}`;
}

/** Valor de um indicador como aparece nos cartões e no gráfico (dólar com 4 casas, como a PTAX). */
export function fmtIndicator(id: "selic" | "cdi" | "ipca" | "dolar", n: number): string {
  return id === "dolar" ? `R$ ${fmtNumber(n, 4)}` : fmtPercent(n);
}

/** Aviso de conteúdo educacional do painel (o `DISCLAIMER` do questionário fala do "seu questionário"). */
export const ECONOMIC_DISCLAIMER =
  "Conteúdo educacional. Os indicadores vêm dos dados abertos do Banco Central do Brasil e a leitura do cenário é uma explicação geral, gerada por inteligência artificial ou por regras locais. Não constitui recomendação individualizada de investimento nem promessa de rentabilidade. Rentabilidade passada não garante resultados futuros. Consulte um profissional certificado antes de investir.";

/** "2026-11-04" -> "04/11/2026" */
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** "2026-11-04" -> "04/11" */
export function fmtDayMonth(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}`;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2026-09-01" -> "set/2026" */
export function fmtMonthYear(iso: string): string {
  const [y, m] = iso.slice(0, 10).split("-");
  return `${MONTHS[Number(m) - 1]}/${y}`;
}
