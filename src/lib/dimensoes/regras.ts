/**
 * Regras de inconsistência entre as respostas. Todo o cálculo é do sistema (a IA nunca decide alerta).
 *
 * Os alertas são INFORMATIVOS: não mudam o perfil, a pontuação nem a alocação, e não bloqueiam nada.
 * Cada regra tem nome, condição e texto. Os limites vêm de LIMITES (mapeamento.ts); as perguntas usadas
 * diretamente (Q5, Q6, Q11, Q14) estão nomeadas abaixo para facilitar a revisão.
 */
import type { Answers, Profile } from "../suitability/scoring.ts";
import { LIMITES, type DimensionId } from "./mapeamento.ts";
import type { Alerta } from "./tipos.ts";

/** Perguntas lidas diretamente pelas regras (ids do questionário atual, mapeamento versão 1). */
const Q_OBJETIVO = 5; // principal objetivo: A = preservar capital
const Q_PRAZO = 6; // prazo para usar o dinheiro: A < 1 ano, B 1 a 3 anos
const Q_PERDA_15 = 11; // reação a uma perda de 15%: C = manteria, D = compraria mais
const Q_PCT_RISCO = 14; // % do patrimônio em aplicações de risco: D = mais de 50%

export interface ContextoRegras {
  /** Nota (0 a 100) de cada dimensão. */
  notas: Record<DimensionId, number>;
  respostas: Answers;
  perfil: Profile;
  pontuacao: number;
}

export interface Regra {
  id: string;
  nome: string;
  severidade: Alerta["severidade"];
  /** `jaDisparadas`: ids das regras anteriores que dispararam (para regras gerais não repetirem as específicas). */
  condicao: (ctx: ContextoRegras, jaDisparadas: ReadonlySet<string>) => boolean;
  texto: string;
  /** Frase de reflexão (usada no texto local da leitura). */
  reflexao: string;
}

const PERFIS_DE_RISCO: Profile[] = ["Arrojado", "Agressivo"];

/** As quatro regras que comparam dimensões específicas (a de disparidade só vale se nenhuma delas disparou). */
const REGRAS_ESPECIFICAS = [
  "horizonte-curto-tolerancia-alta",
  "pouco-conhecimento-respostas-agressivas",
  "capacidade-baixa-perfil-arrojado",
  "preservar-aceitando-grandes-perdas",
];

export const REGRAS: Regra[] = [
  {
    id: "horizonte-curto-tolerancia-alta",
    nome: "Horizonte curto com tolerância alta",
    severidade: "atencao",
    condicao: ({ notas, respostas }) =>
      (respostas[Q_PRAZO] === "A" || respostas[Q_PRAZO] === "B") && notas.tolerancia >= LIMITES.muitoAltaDesde,
    texto:
      "Você pretende usar o dinheiro em até 3 anos, mas suas respostas indicam alta tolerância a perdas. Em prazos curtos, uma queda pode não ter tempo de se recuperar antes de você precisar do dinheiro.",
    reflexao: "vale pensar se o prazo e a tolerância a oscilações estão alinhados.",
  },
  {
    id: "pouco-conhecimento-respostas-agressivas",
    nome: "Pouco conhecimento com respostas agressivas",
    severidade: "atencao",
    condicao: ({ notas }) => notas.conhecimento <= LIMITES.baixaAte && notas.tolerancia >= LIMITES.muitoAltaDesde,
    texto:
      "Suas respostas indicam pouca familiaridade com investimentos e, ao mesmo tempo, grande disposição para assumir riscos. É comum aceitar riscos na teoria e reagir de outro jeito quando a queda acontece.",
    reflexao: "vale pensar em conhecer melhor os produtos para saber se essa disposição se mantém na prática.",
  },
  {
    id: "capacidade-baixa-perfil-arrojado",
    nome: "Capacidade financeira limitada com perfil de maior risco",
    severidade: "atencao",
    condicao: ({ notas, perfil }) => notas.situacao <= LIMITES.baixaAte && PERFIS_DE_RISCO.includes(perfil),
    texto:
      "Seu perfil está entre os que aceitam mais risco, mas suas respostas sobre idade, renda, poupança e patrimônio indicam uma capacidade financeira limitada de absorver perdas. Querer correr risco e poder absorvê-lo são coisas diferentes, e as duas importam.",
    reflexao: "vale pensar na diferença entre querer correr risco e poder absorver perdas.",
  },
  {
    id: "preservar-aceitando-grandes-perdas",
    nome: "Preservar o capital aceitando perdas grandes",
    severidade: "atencao",
    condicao: ({ respostas }) =>
      respostas[Q_OBJETIVO] === "A" &&
      (respostas[Q_PERDA_15] === "C" || respostas[Q_PERDA_15] === "D" || respostas[Q_PCT_RISCO] === "D"),
    texto:
      "Você indicou que o principal objetivo é preservar o capital, mas também disse que manteria ou aumentaria o investimento diante de uma perda de 15% ou colocaria mais da metade do patrimônio em aplicações de risco. Esses dois pontos puxam em direções opostas.",
    reflexao: "vale pensar qual dos dois pesa mais para você.",
  },
  {
    id: "disparidade-entre-dimensoes",
    nome: "Grande distância entre as dimensões",
    severidade: "info",
    condicao: ({ notas }, jaDisparadas) => {
      const valores = Object.values(notas);
      const disparidade = Math.max(...valores) - Math.min(...valores);
      // Regra geral: só aparece quando nenhuma regra específica já explicou a diferença.
      return disparidade >= LIMITES.muitoAltaDesde && !REGRAS_ESPECIFICAS.some((id) => jaDisparadas.has(id));
    },
    texto:
      "Suas dimensões ficaram bem distantes umas das outras (por exemplo, uma muito alta e outra muito baixa). Isso pode refletir a sua realidade, mas é um bom motivo para olhar cada resposta com calma.",
    reflexao: "vale olhar cada dimensão com calma e ver se o conjunto representa você.",
  },
  {
    id: "respostas-uniformes",
    nome: "Respostas todas na mesma alternativa",
    severidade: "info",
    condicao: ({ respostas }) => {
      const valores = Object.values(respostas);
      return valores.length > 1 && valores.every((v) => v === valores[0]);
    },
    texto:
      "Todas as respostas ficaram na mesma alternativa. Isso pode acontecer, mas também pode indicar respostas dadas sem leitura atenta. Se for o caso, refazer o questionário com calma pode dar um retrato mais fiel.",
    reflexao: "vale reler as perguntas com calma e, se quiser, refazer o questionário.",
  },
];

/** Avalia todas as regras, na ordem em que aparecem em REGRAS. */
export function avaliarRegras(ctx: ContextoRegras, regras: Regra[] = REGRAS): Alerta[] {
  const disparadas = new Set<string>();
  const alertas: Alerta[] = [];
  for (const r of regras) {
    if (!r.condicao(ctx, disparadas)) continue;
    disparadas.add(r.id);
    alertas.push({ id: r.id, nome: r.nome, severidade: r.severidade, texto: r.texto, reflexao: r.reflexao });
  }
  return alertas;
}
