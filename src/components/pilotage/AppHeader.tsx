"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut, Menu, Monitor, Moon, RefreshCw, Search, Sun, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";
import type { ThemeChoice } from "@/hooks/useTheme";
import { Button } from "@/components/ds/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ds/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ds/tooltip";

function initiales(nom: string) {
  return nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * En-tête du Centre de pilotage.
 *
 * Il ne contient que ce qui est vrai partout : où je suis, comment je cherche,
 * quand les chiffres ont été rafraîchis, qui je suis. Tout le reste — les
 * actions métier — vit dans la palette ⌘K ou dans l'en-tête du panneau concerné,
 * au contact de la donnée qu'il modifie.
 */
export function AppHeader({
  title = "Centre de pilotage",
  nom,
  role,
  majLe,
  loading,
  onOpenSearch,
  onOpenMobileNav,
  onRefresh,
  theme,
  onSetTheme,
}: {
  /** Libellé du fil d'Ariane — un écran par rôle porte son propre titre. */
  title?: string;
  nom: string;
  role: string;
  majLe: Date | null;
  loading: boolean;
  onOpenSearch: () => void;
  onOpenMobileNav: () => void;
  onRefresh: () => void;
  theme: ThemeChoice;
  onSetTheme: (t: ThemeChoice) => void;
}) {
  const router = useRouter();

  const deconnexion = async () => {
    await createClient().auth.signOut();
    router.replace("/login");
  };

  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card/85 px-3 backdrop-blur-md sm:px-5 print:hidden">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onOpenMobileNav}
        className="lg:hidden"
        aria-label="Ouvrir la navigation"
      >
        <Menu />
      </Button>

      <nav aria-label="Fil d'Ariane" className="min-w-0">
        <ol className="flex items-center gap-1.5 text-[13px]">
          <li className="hidden font-bold tracking-wide text-accent uppercase sm:block">SGFN</li>
          <li className="hidden text-border-strong sm:block" aria-hidden>
            /
          </li>
          <li className="truncate font-semibold text-foreground">{title}</li>
        </ol>
      </nav>

      {/* Recherche — déclencheur, pas un champ : la saisie se fait dans la palette. */}
      <button
        type="button"
        onClick={onOpenSearch}
        className={cn(
          "ml-auto flex h-8 items-center gap-2 rounded-md border border-border bg-inset px-2.5 text-[13px] text-muted-foreground transition-colors",
          "hover:border-border-strong hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
          "sm:w-56 md:w-64",
        )}
        aria-label="Rechercher (Ctrl+K)"
      >
        <Search className="size-3.5 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Rechercher…</span>
        <kbd className="ml-auto hidden rounded border border-border bg-card px-1.5 py-px text-[10.5px] font-semibold sm:inline">
          ⌘K
        </kbd>
      </button>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon-sm" onClick={onRefresh} aria-label="Actualiser les données">
            <RefreshCw className={cn(loading && "animate-spin")} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {majLe
            ? `Actualisé à ${majLe.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
            : "Actualiser"}
        </TooltipContent>
      </Tooltip>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Changer de thème">
            <ThemeIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onSetTheme("light")}>
            <Sun />
            Clair
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onSetTheme("dark")}>
            <Moon />
            Sombre
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onSetTheme("system")}>
            <Monitor />
            Système
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring/50"
            aria-label="Menu du compte"
          >
            {initiales(nom) || "?"}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuLabel className="normal-case">
            <span className="block truncate text-[13px] font-semibold text-foreground">{nom}</span>
            <span className="mt-0.5 block text-[11px] font-medium text-muted-foreground capitalize">{role}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => router.push("/dashboard/profil")}>
            <UserRound />
            Mon profil
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem tone="danger" onSelect={() => void deconnexion()}>
            <LogOut />
            Se déconnecter
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
