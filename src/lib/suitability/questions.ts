/**
 * Questionário de Suitability (18 questões) - Apêndice do Checkpoint 1.
 * Fundamentado nas "Regras e Procedimentos de Suitability" da ANBIMA (2021).
 * Cada alternativa vale 1 (A) a 4 (D) pontos.
 */

export type OptionKey = "A" | "B" | "C" | "D";

export interface Question {
  id: number;
  /** Dimensão avaliada, usada para agrupar as etapas do formulário. */
  group: "situacao" | "objetivos" | "conhecimento" | "tolerancia";
  text: string;
  options: Record<OptionKey, string>;
}

export const GROUPS: Record<Question["group"], { title: string; hint: string }> = {
  situacao: {
    title: "Sua situação financeira",
    hint: "Idade, renda e patrimônio disponível.",
  },
  objetivos: {
    title: "Objetivos e prazo",
    hint: "O que você quer alcançar e em quanto tempo.",
  },
  conhecimento: {
    title: "Conhecimento e experiência",
    hint: "Sua familiaridade com o mercado financeiro.",
  },
  tolerancia: {
    title: "Tolerância ao risco",
    hint: "Como você lida com oscilações e perdas.",
  },
};

export const QUESTIONS: Question[] = [
  {
    id: 1, group: "situacao", text: "Qual é a sua idade?",
    options: { A: "Acima de 65 anos", B: "Entre 51 e 65 anos", C: "Entre 31 e 50 anos", D: "Até 30 anos" },
  },
  {
    id: 2, group: "situacao", text: "Qual é sua principal fonte de renda?",
    options: { A: "Aposentadoria ou benefícios", B: "Salário fixo", C: "Salário e renda complementar", D: "Diversas fontes de renda ou negócio próprio" },
  },
  {
    id: 3, group: "situacao", text: "Qual percentual da sua renda mensal você consegue poupar?",
    options: { A: "Menos de 5%", B: "Entre 5% e 10%", C: "Entre 11% e 20%", D: "Acima de 20%" },
  },
  {
    id: 4, group: "situacao", text: "Qual é o seu patrimônio financeiro disponível para investimentos?",
    options: { A: "Até R$ 10.000", B: "Entre R$ 10.001 e R$ 50.000", C: "Entre R$ 50.001 e R$ 200.000", D: "Acima de R$ 200.000" },
  },
  {
    id: 5, group: "objetivos", text: "Qual o principal objetivo dos seus investimentos?",
    options: { A: "Preservar capital", B: "Obter renda complementar", C: "Crescimento moderado do patrimônio", D: "Maximizar o crescimento do patrimônio" },
  },
  {
    id: 6, group: "objetivos", text: "Em quanto tempo você pretende utilizar a maior parte desse investimento?",
    options: { A: "Menos de 1 ano", B: "Entre 1 e 3 anos", C: "Entre 3 e 5 anos", D: "Mais de 5 anos" },
  },
  {
    id: 7, group: "conhecimento", text: "Como você classificaria seu conhecimento sobre investimentos?",
    options: { A: "Nenhum ou muito básico", B: "Básico", C: "Intermediário", D: "Avançado" },
  },
  {
    id: 8, group: "conhecimento", text: "Você já investiu em quais produtos?",
    options: { A: "Apenas poupança", B: "CDB, Tesouro Direto ou renda fixa", C: "Fundos de investimento", D: "Ações, ETFs ou ativos internacionais" },
  },
  {
    id: 9, group: "conhecimento", text: "Qual sua experiência com investimentos?",
    options: { A: "Menos de 1 ano", B: "Entre 1 e 3 anos", C: "Entre 3 e 5 anos", D: "Mais de 5 anos" },
  },
  {
    id: 10, group: "tolerancia", text: "Como você reagiria se seu investimento perdesse 5% do valor em um mês?",
    options: { A: "Resgataria imediatamente", B: "Ficaria preocupado", C: "Manteria o investimento", D: "Aproveitaria para investir mais" },
  },
  {
    id: 11, group: "tolerancia", text: "E se a perda fosse de 15%?",
    options: { A: "Resgataria imediatamente", B: "Reduziria a posição", C: "Manteria o investimento", D: "Compraria mais" },
  },
  {
    id: 12, group: "tolerancia", text: "O que é mais importante para você?",
    options: { A: "Segurança", B: "Segurança com algum rendimento", C: "Equilíbrio entre risco e retorno", D: "Alto potencial de retorno" },
  },
  {
    id: 13, group: "tolerancia", text: "Qual dessas carteiras você escolheria?",
    options: {
      A: "Ganho anual estimado de 8%, praticamente sem oscilações",
      B: "Ganho anual estimado de 10%, com pequenas oscilações",
      C: "Ganho anual estimado de 15%, com oscilações moderadas",
      D: "Ganho anual estimado de 25%, com oscilações elevadas",
    },
  },
  {
    id: 14, group: "tolerancia", text: "Qual percentual do seu patrimônio você estaria disposto a investir em aplicações com risco?",
    options: { A: "Até 10%", B: "Até 25%", C: "Até 50%", D: "Mais de 50%" },
  },
  {
    id: 15, group: "conhecimento", text: "Com que frequência você acompanha seus investimentos?",
    options: { A: "Raramente", B: "Algumas vezes por ano", C: "Mensalmente", D: "Semanalmente ou diariamente" },
  },
  {
    id: 16, group: "tolerancia", text: "Se houvesse possibilidade de maior retorno, você aceitaria oscilações temporárias no valor investido?",
    options: { A: "Não", B: "Pouco", C: "Sim", D: "Totalmente" },
  },
  {
    id: 17, group: "tolerancia", text: "Como você definiria sua tolerância ao risco?",
    options: { A: "Muito baixa", B: "Baixa", C: "Moderada", D: "Alta" },
  },
  {
    id: 18, group: "tolerancia", text: "Qual frase melhor representa você como investidor?",
    options: {
      A: "\"Prefiro não correr riscos.\"",
      B: "\"Aceito pequenos riscos para obter melhores retornos.\"",
      C: "\"Aceito riscos moderados visando crescimento.\"",
      D: "\"Aceito riscos elevados em busca de retornos superiores.\"",
    },
  },
];
