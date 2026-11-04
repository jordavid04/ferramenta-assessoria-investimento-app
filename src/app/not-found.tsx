import Link from "next/link"
import { ArrowRightIcon, CompassIcon, HomeIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex flex-col items-center py-10 text-center sm:py-16">
      <Badge variant="outline" className="border-secondary/30 bg-secondary/5 text-secondary">
        <CompassIcon data-icon="inline-start" />
        Erro 404
      </Badge>
      <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
        Página não encontrada
      </h1>
      <p className="mt-3 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
        Esse endereço não existe ou foi movido. Volte ao início ou comece o questionário de
        suitability.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button
          size="lg"
          className="cursor-pointer"
          render={<Link href="/" />}
          nativeButton={false}
        >
          <HomeIcon data-icon="inline-start" />
          Voltar ao início
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="cursor-pointer"
          render={<Link href="/suitability" />}
          nativeButton={false}
        >
          Começar o questionário
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </div>
    </div>
  )
}
