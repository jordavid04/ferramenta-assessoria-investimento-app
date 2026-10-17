export const metadata = { title: "Sobre o projeto — InvestPro" };

export default function Sobre() {
  return (
    <article className="space-y-4 rounded-2xl bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-extrabold">Sobre o projeto</h1>
      <p>
        O InvestPro é um Projeto de Extensão Universitária II do curso de Bacharelado em Sistemas de Informação. Une
        um formulário de Suitability fundamentado nas regras da ANBIMA à IA generativa (Google Gemini) para apoiar
        investidores iniciantes, com foco em servidores públicos.
      </p>
      <h2 className="pt-2 text-lg font-bold">Como funciona</h2>
      <ul className="list-disc space-y-1 pl-6 text-slate-700">
        <li>O perfil é calculado por regras fixas e auditáveis (18 questões, 18 a 72 pontos), nunca pela IA.</li>
        <li>A IA apenas explica o perfil e sugere uma alocação, validada contra limites do sistema.</li>
        <li>Se a IA estiver indisponível, um motor local assume e o usuário continua atendido.</li>
        <li>Não coletamos nome, CPF, e-mail ou renda exata: as respostas são anônimas.</li>
      </ul>
      <p className="text-sm text-slate-500">
        Aviso: conteúdo exclusivamente educacional. Não é recomendação individualizada de investimento nem substitui
        um profissional certificado.
      </p>
    </article>
  );
}
