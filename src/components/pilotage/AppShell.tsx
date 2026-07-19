"use client";

import * as React from "react";
import { MotionConfig } from "framer-motion";

import { cn } from "@/lib/utils";
import { useProfile } from "@/hooks/useProfile";
import { useTheme } from "@/hooks/useTheme";
import { usePersistentState } from "@/hooks/usePersistentState";
import { hasCustomNavOrder, visibleNavItems, type BadgeKey } from "@/lib/navigation";
import { TooltipProvider } from "@/components/ds/tooltip";
import { Sheet, SheetContent, SheetTitle } from "@/components/ds/sheet";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { CommandPalette } from "./CommandPalette";

const CLE_REPLI = "sgnf:nav-collapsed";

/**
 * Coquille du Centre de pilotage : navigation, en-tête, palette ⌘K, thème.
 *
 * C'est ici qu'est posée la classe `dark` — et nulle part ailleurs. Le mode
 * sombre est donc strictement contenu à cet écran tant que le reste de la
 * plateforme n'a pas migré sur le Design System.
 *
 * `MotionConfig reducedMotion="user"` neutralise toutes les animations de
 * l'arbre quand l'OS le demande : aucun composant enfant n'a besoin de le
 * gérer lui-même.
 */
export function AppShell({
  children,
  loading,
  majLe = null,
  counts,
  onRefresh,
  onNouveauDossier,
  wide = false,
}: {
  children: React.ReactNode;
  /** Accepté pour compat (des pages le passent encore) mais non affiché :
   *  l'en-tête handoff montre la salutation, plus le fil d'Ariane. */
  title?: string;
  loading: boolean;
  majLe?: Date | null;
  /** Pastilles « à faire » — fournies par la page (cf. `useBadgeCounts`), pour
   *  que la barre latérale et le Centre d'alertes affichent le même chiffre. */
  counts: Partial<Record<BadgeKey, number>>;
  onRefresh: () => void;
  /** Action « Nouveau dossier ADU » — propre au Centre de pilotage admin.
   *  Omise sur les autres écrans : la palette masque alors l'entrée. */
  onNouveauDossier?: () => void;
  /** Contenu large (1480 px) pour le Centre de pilotage et sa carte ; sinon
   *  1200 px, la largeur des dashboards persona du handoff. */
  wide?: boolean;
}) {
  const { profile, loading: profileLoading } = useProfile();
  const { choice, isDark, setTheme } = useTheme();

  const [repli, setRepli] = usePersistentState<"0" | "1">(CLE_REPLI, "0", (v): v is "0" | "1" => v === "0" || v === "1");
  const collapsed = repli === "1";

  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  const groupe = profile?.groupe ?? null;
  const items = React.useMemo(() => visibleNavItems(groupe, profileLoading), [groupe, profileLoading]);
  // Un rôle avec un ordre de nav personnalisé veut une liste plate, lue dans
  // cet ordre précis — le regroupement par section le shufflerait.
  const grouped = !hasCustomNavOrder(groupe);

  const toggleCollapsed = React.useCallback(() => setRepli(collapsed ? "0" : "1"), [collapsed, setRepli]);

  // ⌘K / Ctrl+K — ignoré quand la frappe part d'un champ de saisie.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey)) return;
      const cible = e.target as HTMLElement | null;
      if (cible && /^(INPUT|TEXTAREA|SELECT)$/.test(cible.tagName)) return;
      e.preventDefault();
      setPaletteOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const nom = profile?.nom_complet ?? "Administrateur";
  const role = profile?.groupe ?? "admin";

  return (
    <div className={cn(isDark && "dark")}>
      <MotionConfig reducedMotion="user">
        <TooltipProvider>
          <div className="flex min-h-screen bg-background text-foreground">
            {/* Navigation — colonne fixe à partir de lg */}
            <aside
              className={cn(
                "hidden shrink-0 border-r border-border transition-[width] duration-200 ease-out lg:block print:hidden",
                collapsed ? "w-[4.75rem]" : "w-[264px]",
              )}
            >
              <div className="sticky top-0 h-screen">
                <AppSidebar
                  items={items}
                  counts={counts}
                  collapsed={collapsed}
                  grouped={grouped}
                  onToggleCollapsed={toggleCollapsed}
                />
              </div>
            </aside>

            {/* Navigation — tiroir sous lg */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetContent side="left" className="p-0">
                <SheetTitle className="sr-only">Navigation principale</SheetTitle>
                <AppSidebar
                  items={items}
                  counts={counts}
                  collapsed={false}
                  grouped={grouped}
                  onNavigate={() => setMobileOpen(false)}
                />
              </SheetContent>
            </Sheet>

            <div className="flex min-w-0 flex-1 flex-col">
              <AppHeader
                nom={nom}
                role={role}
                majLe={majLe}
                loading={loading}
                onOpenSearch={() => setPaletteOpen(true)}
                onOpenMobileNav={() => setMobileOpen(true)}
                onRefresh={onRefresh}
                theme={choice}
                onSetTheme={setTheme}
              />

              {/* Le rythme vertical (gap-5) et la respiration latérale sont posés
                  ici, une seule fois : aucun panneau ne gère sa propre marge. */}
              <main
                className={cn(
                  "mx-auto flex w-full flex-1 flex-col gap-5 p-4 sm:p-6 lg:px-8 lg:py-7 print:p-0",
                  wide ? "max-w-[1480px]" : "max-w-[1200px]",
                )}
              >
                {children}
              </main>

              <footer className="px-6 pb-6 text-center text-[11px] text-muted-foreground print:hidden">
                SGNF — Système de Gestion Numérique du Foncier · République de Côte d&apos;Ivoire
              </footer>
            </div>
          </div>

          <CommandPalette
            open={paletteOpen}
            onOpenChange={setPaletteOpen}
            items={items}
            onNouveauDossier={onNouveauDossier}
            onRefresh={onRefresh}
            onSetTheme={setTheme}
          />
        </TooltipProvider>
      </MotionConfig>
    </div>
  );
}
