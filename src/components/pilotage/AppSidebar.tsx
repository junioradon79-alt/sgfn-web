"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";
import { SECTION_LABELS, SECTION_ORDER, type BadgeKey, type NavItem } from "@/lib/navigation";
import { Button } from "@/components/ds/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ds/tooltip";

/**
 * Barre latérale du Centre de pilotage.
 *
 * Deux différences de fond avec la barre historique :
 *   — les 20+ entrées sont regroupées en sections, parce qu'une liste plate de
 *     vingt liens n'a pas de hiérarchie et se parcourt linéairement ;
 *   — elle se replie en rail d'icônes, pour rendre l'espace à la carte, qui est
 *     le composant qui mérite les pixels.
 *
 * Les règles d'accès et les pastilles viennent de `@/lib/navigation` : elles
 * sont identiques à celles de la barre historique.
 */
export function AppSidebar({
  items,
  counts,
  collapsed,
  grouped = true,
  onToggleCollapsed,
  onNavigate,
}: {
  items: NavItem[];
  counts: Partial<Record<BadgeKey, number>>;
  collapsed: boolean;
  /** false = liste plate dans l'ordre donné (rôles avec un ordre personnalisé,
   *  cf. `hasCustomNavOrder`) — le regroupement par section le shufflerait. */
  grouped?: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const renderItem = (item: NavItem) => {
    const active = pathname === item.href || pathname.startsWith(item.href + "/");
    const badge = item.badgeKey ? counts[item.badgeKey] ?? 0 : 0;
    const Icon = item.icon;

    const link = (
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group relative flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] font-medium outline-none transition-colors",
          "focus-visible:ring-2 focus-visible:ring-ring/50",
          active ? "bg-accent-subtle text-accent" : "text-muted-foreground hover:bg-inset hover:text-foreground",
          collapsed && "justify-center px-0",
        )}
      >
        {/* Repère d'onglet actif — un trait, pas un fond criard. */}
        {active && (
          <motion.span
            layoutId="nav-active"
            transition={spring}
            className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-accent"
            aria-hidden
          />
        )}
        <span className="relative shrink-0">
          <Icon className="size-4" aria-hidden />
          {badge > 0 && collapsed && (
            <span className="absolute -top-1 -right-1 size-2 rounded-full bg-danger ring-2 ring-card" aria-hidden />
          )}
        </span>
        {!collapsed && (
          <>
            <span className="truncate">{item.label}</span>
            {badge > 0 && (
              <span className="ml-auto inline-flex min-w-[18px] items-center justify-center rounded-full bg-danger px-1.5 py-0.5 text-[10.5px] font-bold leading-none text-white tabular">
                {badge}
              </span>
            )}
          </>
        )}
      </Link>
    );

    return (
      <li key={item.href}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="right">
              {item.label}
              {badge > 0 && ` · ${badge} à traiter`}
            </TooltipContent>
          </Tooltip>
        ) : (
          link
        )}
      </li>
    );
  };

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Marque */}
      <div className={cn("flex h-14 shrink-0 items-center border-b border-border", collapsed ? "justify-center px-2" : "gap-2.5 px-4")}>
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label="Accueil SGFN"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary p-[3px]">
            <span className="flex size-full items-center justify-center overflow-hidden rounded-[5px] bg-white">
              <Image src="/logo-embleme.png" alt="" width={24} height={24} className="object-contain" priority />
            </span>
          </span>
          {!collapsed && (
            <span className="flex min-w-0 flex-col leading-none">
              <span className="font-display text-[13px] font-extrabold tracking-tight text-foreground uppercase">SGFN</span>
              <span className="mt-0.5 truncate text-[10px] font-medium text-muted-foreground">Centre de pilotage</span>
            </span>
          )}
        </Link>

        {!collapsed && onToggleCollapsed && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleCollapsed}
            className="ml-auto hidden lg:inline-flex"
            aria-label="Replier la navigation"
          >
            <PanelLeftClose />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3" aria-label="Navigation principale">
        {grouped ? (
          SECTION_ORDER.map((section) => {
            const sectionItems = items.filter((i) => i.section === section);
            if (sectionItems.length === 0) return null;

            return (
              <div key={section} className="mb-4 last:mb-0">
                {collapsed ? (
                  <div className="mx-2 mb-2 h-px bg-border" aria-hidden />
                ) : (
                  <p className="mb-1 px-2 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                    {SECTION_LABELS[section]}
                  </p>
                )}
                <ul className="flex flex-col gap-0.5">{sectionItems.map((item) => renderItem(item))}</ul>
              </div>
            );
          })
        ) : (
          <ul className="flex flex-col gap-0.5">{items.map((item) => renderItem(item))}</ul>
        )}
      </nav>

      {collapsed && onToggleCollapsed && (
        <div className="hidden border-t border-border p-2 lg:block">
          <Button variant="ghost" size="icon-sm" onClick={onToggleCollapsed} className="w-full" aria-label="Déplier la navigation">
            <PanelLeftOpen />
          </Button>
        </div>
      )}
    </div>
  );
}
