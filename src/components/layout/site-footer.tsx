import { GraduationCapIcon, LandmarkIcon } from "lucide-react"
import { Separator } from "@/components/ui/separator"

export function SiteFooter() {
  return (
    <footer className="bg-card">
      <Separator />
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-8 sm:px-6 lg:px-8">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <LandmarkIcon className="size-4 text-secondary" />
          InvestPro
        </p>
        <p className="flex max-w-2xl items-start gap-2 text-xs leading-relaxed text-muted-foreground">
          <GraduationCapIcon className="mt-0.5 size-3.5 shrink-0" />
          Projeto de Extensão Universitária II · BSI. Conteúdo educacional; não constitui recomendação
          individualizada de investimento.
        </p>
      </div>
    </footer>
  )
}
