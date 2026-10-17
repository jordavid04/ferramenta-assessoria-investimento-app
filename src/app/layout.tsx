import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "InvestPro — Assessoria de investimento",
  description: "Descubra seu perfil de investidor (Suitability ANBIMA) e receba orientação educacional com IA.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen font-sans antialiased">
        <header className="bg-nav text-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-xl font-extrabold tracking-tight">InvestPro</Link>
            <nav className="flex gap-5 text-sm text-slate-200">
              <Link href="/suitability" className="hover:text-white">Descobrir meu perfil</Link>
              <Link href="/sobre" className="hover:text-white">Sobre o projeto</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 pb-10 text-xs text-slate-500">
          Projeto de Extensão Universitária II · BSI. Conteúdo educacional; não constitui recomendação individualizada de investimento.
        </footer>
      </body>
    </html>
  );
}
