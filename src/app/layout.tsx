import type { Metadata } from "next"
import { Inter, Manrope } from "next/font/google"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { SiteSidebar } from "@/components/layout/site-sidebar"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
})

export const metadata: Metadata = {
  title: "InvestPro — Assessoria de investimento",
  description:
    "Descubra seu perfil de investidor (Suitability ANBIMA) e receba orientação educacional com IA.",
  icons: {
    icon: "/banco.png",
    apple: "/banco.png",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={cn("font-sans", inter.variable, manrope.variable)}>
      <body className="min-h-screen font-sans antialiased">
        <SiteHeader />
        {/* Mesma distância (gap = padding lateral) entre a borda da tela, o menu e o conteúdo. */}
        <div className="px-4 py-8 sm:flex sm:gap-8 sm:px-8">
          <SiteSidebar />
          <main className="min-w-0 max-w-5xl flex-1">{children}</main>
        </div>
        <SiteFooter />
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  )
}
