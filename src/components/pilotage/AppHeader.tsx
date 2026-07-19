"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, LogOut, Menu, Monitor, Moon, RefreshCw, Search, Sun, UserRound } from "lucide-react";

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

/** Bouton d'action en icône, style handoff : boîte bordée 38 px, surface pleine. */
const ICON_BTN = "size-[38px] rounded-[11px] text-muted-foreground";

/**
 * En-tête commun des espaces (handoff design 18/07).
 *
 * Ce qui est vrai partout : qui je suis (salutation + date), comment je cherche
 * (déclencheur ⌘K au centre), et le trio cloche / thème / profil à droite. Les
 * actions métier restent dans la palette ⌘K ou l'en-tête du panneau concerné.
 */
export function AppHeader({
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

  // Date longue « Lundi 13 Juillet 2026 ». Calculée au premier rendu client :
  // l'en-tête ne figure jamais dans le HTML prérendu (il est derrière le verrou
  // d'auth de DashboardShell), donc aucun risque d'écart d'hydratation.
  const dateStr = React.useMemo(() => {
    const s = new Date().toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return s.replace(/(^|\s)(\p{L})/gu, (_m, sp: string, ch: string) => sp + ch.toUpperCase());
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-[72px] shrink-0 items-center gap-3 border-b border-border bg-card/[0.88] px-4 backdrop-blur-md sm:gap-[18px] sm:px-6 print:hidden">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onOpenMobileNav}
        className="lg:hidden"
        aria-label="Ouvrir la navigation"
      >
        <Menu />
      </Button>

      {/* Salutation + date — l'identité de l'espace, à la place du fil d'Ariane. */}
      <div className="min-w-0">
        <div className="truncate text-[17px] font-bold tracking-tight text-foreground">Bonjour, {nom}</div>
        {dateStr && (
          <div className="mt-0.5 hidden truncate text-[12.5px] font-medium text-muted-foreground sm:block">
            {dateStr}
          </div>
        )}
      </div>

      {/* Recherche — déclencheur ⌘K (la saisie se fait dans la palette). Icône
          seule sous sm, champ pleine largeur au-delà. */}
      <button
        type="button"
        onClick={onOpenSearch}
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center gap-2.5 rounded-[13px] border border-border bg-inset text-muted-foreground transition-colors",
          "hover:border-border-strong hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
          "sm:w-auto sm:min-w-0 sm:flex-1 sm:max-w-[420px] sm:justify-start sm:pr-2 sm:pl-4",
        )}
        aria-label="Rechercher (Ctrl+K)"
      >
        <Search className="size-[17px] shrink-0 text-muted-2" aria-hidden />
        <span className="hidden flex-1 truncate text-left text-[13.5px] sm:inline">Rechercher un lot, un dossier…</span>
        <kbd className="ml-auto hidden rounded-md border border-border bg-card px-2 py-1 text-[11px] font-semibold sm:inline">
          Ctrl K
        </kbd>
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              className={cn(ICON_BTN, "hidden sm:inline-flex")}
              onClick={onRefresh}
              aria-label="Actualiser les données"
            >
              <RefreshCw className={cn(loading && "animate-spin")} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {majLe
              ? `Actualisé à ${majLe.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
              : "Actualiser"}
          </TooltipContent>
        </Tooltip>

        <Button
          variant="outline"
          className={cn(ICON_BTN)}
          onClick={() => router.push("/dashboard/messages")}
          aria-label="Notifications et messages"
        >
          <Bell />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className={cn(ICON_BTN)} aria-label="Changer de thème">
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
              className="flex items-center gap-2.5 rounded-xl p-1 pr-1.5 outline-none transition-colors hover:bg-inset focus-visible:ring-2 focus-visible:ring-ring/50"
              aria-label="Menu du compte"
            >
              <span className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground">
                {initiales(nom) || "?"}
              </span>
              <span className="hidden min-w-0 flex-col text-left leading-tight md:flex">
                <span className="truncate text-[13.5px] font-bold text-foreground">{nom}</span>
                <span className="truncate text-[11.5px] font-medium text-muted-foreground capitalize">{role}</span>
              </span>
              <ChevronDown className="hidden size-4 text-muted-2 md:block" aria-hidden />
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
      </div>
    </header>
  );
}
