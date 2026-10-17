import Link from "next/link";

const steps = [
  { n: "1", t: "Responda 18 questões", d: "Questionário de Suitability baseado nas regras da ANBIMA, dividido em 4 etapas curtas." },
  { n: "2", t: "Receba seu perfil", d: "Conservador, Moderado, Arrojado ou Agressivo, calculado de forma transparente." },
  { n: "3", t: "Entenda com a IA", d: "O Google Gemini explica seu perfil e sugere uma alocação por classe de ativo." },
];

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="rounded-2xl bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand">Educação financeira aplicada</p>
        <h1 className="mt-2 text-3xl font-extrabold sm:text-4xl">Descubra seu perfil de investidor e organize seu primeiro passo.</h1>
        <p className="mt-4 max-w-2xl text-slate-600">
          Ferramenta gratuita pensada para servidores públicos e investidores iniciantes. Sem cadastro, sem
          dados pessoais: leva cerca de 5 minutos.
        </p>
        <Link href="/suitability" className="mt-6 inline-block rounded-lg bg-brand px-6 py-3 font-semibold text-white hover:bg-brand-dark">
          Começar o questionário
        </Link>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {steps.map((s) => (
          <div key={s.n} className="rounded-xl bg-white p-5 shadow-sm">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{s.n}</span>
            <h2 className="mt-3 font-bold">{s.t}</h2>
            <p className="mt-1 text-sm text-slate-600">{s.d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
