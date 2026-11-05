import { SparklesIcon, WifiOffIcon } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { ReadingView } from "./tipos"

export function LeituraSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando leitura da simulação">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-28 w-full rounded-2xl" />
    </div>
  )
}

/** `reading`: undefined = carregando · null = não foi possível gerar · objeto = texto. */
export function LeituraCard({ reading, profile }: { reading: ReadingView | null | undefined; profile: string }) {
  if (reading === undefined) return <LeituraSkeleton />

  if (reading === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-bold">Leitura da simulação</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar a leitura em texto agora. Os números acima continuam valendo.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-l-4 border-l-ai">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-ai-bg text-ai">
            <SparklesIcon />
          </span>
          <CardTitle className="font-bold">Leitura da simulação</CardTitle>
          <Badge variant="secondary">
            {reading.source === "gemini" ? (
              <>
                <SparklesIcon data-icon="inline-start" />
                Gemini
              </>
            ) : (
              <>
                <WifiOffIcon data-icon="inline-start" />
                Offline
              </>
            )}
          </Badge>
          <Badge variant="outline">Perfil {profile}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="leading-relaxed text-foreground">{reading.reading}</p>
        <CardDescription>
          {reading.source === "gemini" ? "Texto gerado pelo Google Gemini a partir dos números acima." : "Texto gerado pelo motor local (modo offline)."}{" "}
          Os números e o perfil são calculados pelo sistema, não pela IA.
        </CardDescription>
        {reading.source === "fallback" && (
          <Alert>
            <WifiOffIcon />
            <AlertTitle>Modo offline</AlertTitle>
            <AlertDescription>A IA estava indisponível; usamos o texto local para manter a explicação educacional.</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
