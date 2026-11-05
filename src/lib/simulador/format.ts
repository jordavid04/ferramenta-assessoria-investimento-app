/** Formatação e leitura de números no padrão pt-BR para o simulador (sem dependências de servidor: a tela também usa). */

/** Aviso de conteúdo educacional do simulador. */
export const SIMULATION_DISCLAIMER =
  "Conteúdo educacional. Esta simulação usa hipóteses didáticas para mostrar possibilidades e a diferença entre perfis; não são previsões nem promessas de rentabilidade. Os valores são brutos, sem impostos, taxas de administração ou custos de corretagem, e a rentabilidade hipotética ou passada não garante resultados futuros. A leitura em texto é gerada por inteligência artificial ou por regras locais e não constitui recomendação individualizada de investimento. Consulte um profissional certificado antes de investir."

export function fmtYears(years: number): string {
  const n = Number.isInteger(years) ? String(years) : new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(years)
  return `${n} ${years === 1 ? "ano" : "anos"}`
}

/** Mês de um marco -> "2 anos e 3 meses", "5 meses", "1 ano". */
export function fmtMonths(months: number): string {
  const y = Math.floor(months / 12)
  const m = months % 12
  const parts: string[] = []
  if (y > 0) parts.push(`${y} ${y === 1 ? "ano" : "anos"}`)
  if (m > 0 || y === 0) parts.push(`${m} ${m === 1 ? "mês" : "meses"}`)
  return parts.join(" e ")
}

/**
 * Lê o que a pessoa digitou: "10000", "10.000", "10.000,50", "R$ 1.500", "7,5", "7.5".
 * Devolve NaN quando não dá para entender (a validação do servidor mostra a mensagem).
 */
export function parseDecimalPtBR(text: string): number {
  let s = text.replace(/R\$/gi, "").replace(/\s/g, "")
  if (s === "") return Number.NaN
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".")
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "") // só pontos de milhar: "10.000"
  }
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : Number.NaN
}
