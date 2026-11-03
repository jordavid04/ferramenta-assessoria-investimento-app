"use client"

import Link from "next/link"
import {
  CompassIcon,
  HomeIcon,
  InfoIcon,
  LandmarkIcon,
  MenuIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-nav text-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex cursor-pointer items-center gap-2 text-xl font-bold tracking-tight transition-colors duration-200 hover:text-white/90"
        >
          <LandmarkIcon className="size-5" />
          InvestPro
        </Link>

        <nav className="hidden items-center gap-4 text-sm sm:flex sm:gap-5">
          <Link
            href="/"
            className="flex cursor-pointer items-center gap-1.5 text-slate-300 transition-colors duration-200 hover:text-white"
          >
            <HomeIcon className="size-4" />
            Início
          </Link>
          <Link
            href="/sobre"
            className="flex cursor-pointer items-center gap-1.5 text-slate-300 transition-colors duration-200 hover:text-white"
          >
            <InfoIcon className="size-4" />
            Sobre
          </Link>
          <Button
            size="lg"
            className="cursor-pointer"
            render={<Link href="/suitability" />}
            nativeButton={false}
          >
            <CompassIcon data-icon="inline-start" />
            Descobrir meu perfil
          </Button>
        </nav>

        <div className="flex items-center gap-2 sm:hidden">
          <Button
            size="sm"
            className="cursor-pointer"
            render={<Link href="/suitability" />}
            nativeButton={false}
          >
            <CompassIcon data-icon="inline-start" />
            Meu perfil
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="cursor-pointer text-white hover:bg-white/10 hover:text-white"
                />
              }
            >
              <MenuIcon />
              <span className="sr-only">Menu</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuGroup>
                <DropdownMenuItem render={<Link href="/" />}>
                  <HomeIcon />
                  Início
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/sobre" />}>
                  <InfoIcon />
                  Sobre
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/suitability" />}>
                  <CompassIcon />
                  Descobrir meu perfil
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
