"use client"

import { Component, type ReactNode } from "react"

/**
 * Isola uma parte da página: se ela falhar ao renderizar, mostra `fallback` (ou nada) e o resto segue normal.
 * O módulo de dimensões usa isto para nunca afetar o resultado, o histórico ou o questionário.
 */
export class IsolarFalha extends Component<{ children: ReactNode; fallback?: ReactNode }, { falhou: boolean }> {
  state = { falhou: false }

  static getDerivedStateFromError() {
    return { falhou: true }
  }

  componentDidCatch(error: unknown) {
    console.error("[Dimensões] falha ao exibir a seção", error)
  }

  render() {
    return this.state.falhou ? (this.props.fallback ?? null) : this.props.children
  }
}
