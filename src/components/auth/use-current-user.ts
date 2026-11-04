"use client"

import { useEffect, useState } from "react"

export type AuthUser = { id: string; username: string }

const AUTH_EVENT = "investpro:auth"

/** Avisa o header (e quem mais escuta) que o cookie de sessão mudou. */
export function notifyAuthChanged() {
  window.dispatchEvent(new Event(AUTH_EVENT))
}

export function useCurrentUser() {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch("/api/auth/me")
        const data = (await res.json()) as { user?: AuthUser | null }
        if (!cancelled) setUser(data.user ?? null)
      } catch {
        if (!cancelled) setUser(null)
      }
    }

    void load()
    const onChange = () => {
      void load()
    }
    window.addEventListener(AUTH_EVENT, onChange)
    return () => {
      cancelled = true
      window.removeEventListener(AUTH_EVENT, onChange)
    }
  }, [])

  return user
}
