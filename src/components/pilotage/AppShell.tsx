"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { MotionConfig } from "framer-motion";

import { cn } from "@/lib/utils";
import { useProfile } from "@/hooks/useProfile";
import { useTheme } from "@/hooks/useTheme";
import { usePersistentState } from "@/hooks/usePersistentState";
import { hasCustomNavOrder, libelleEspace, visibleNavItems, type BadgeKey } from "@/lib/navigation";
import { TooltipProvider } from "@/components/ds/tooltip";
import { PortalScopeProvider } from "@/components/ds/portal-scope";
import { Sheet, SheetContent, SheetTitle } from "@/components/ds/sheet";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { CommandPalette } from "./CommandPalette";

const CLE_REPLI = "sgnf:nav-collapsed";

/**
 * Pont `useSearchParams` pour la barre latérale.
 *
 * La barre surligne la sous-entrée d'onglet active (Administration → Rôles…) à
 * partir des paramètres d'URL — mais `useSearchParams` exige un `<Suspense>` en
 * export statique. On l'isole ici : AppShell l'enveloppe d'un `<Suspense>` dont
 * le fallback rend la même barre sans surlignage d'onglet (`activeParams=null`),
 * puis le client réhydrate avec les vrais paramètres.
 */
function SidebarAvecRecherche(props: React.ComponentProps<typeof AppSidebar>) {
  const activeParams = useSearchParams();
  return <AppSidebar {...props} activeParams={activeParams} />;
}

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
  loading: boolean;
  majLe?: Date | null;
  /** Pastilles « à faire » — fournies par la page (cf. `useBadgeCounts`), pour
   *  que la barre latérale et le Centre d'alertes affichent le même chiffre. */
  counts: Partial<Record<BadgeKey, number>>;
  onRefresh: () => void;
  /** Action « Nouveau dossier ADU » — propre au Centre de pilotage admin.
   *  Omise sur les autres écrans : la palette masque alors l'entrée. */
  onNouveauDossier?: () => void;
  /** Contenu large (1480 px) pour les écrans dont le contenu EST la surface
   *  (centre de pilotage, carte) ; sinon 1200 px, la largeur des dashboards
   *  persona du handoff. Largeur seulement — cf. `vueNationale` plus bas pour
   *  le vocabulaire des rubriques. */
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

  // Le handoff est volontairement bilingue : l'écran national dit « Cadastre »
  // et « Dossiers », l'écran métier dit « Registre foncier » et « Instruction ».
  // C'est une affaire de POINT DE VUE, donc de rôle — pas d'écran. Auparavant
  // le choix était accroché à la prop `wide`, si bien qu'un même administrateur
  // voyait ses rubriques se renommer en passant du pilotage au registre des
  // lots. On le dérive du rôle : la nomenclature ne bouge plus sous l'oeil de
  // l'utilisateur.
  const vueNationale = groupe === "admin" || groupe === "verificateur";

  // Propriétés communes aux deux barres (colonne fixe + tiroir mobile) et à leurs
  // fallbacks Suspense — factorisées pour ne pas les tenir à jour en quatre exemplaires.
  const sidebarProps = {
    items,
    counts,
    grouped,
    pilotage: vueNationale,
    sousTitre: libelleEspace(groupe),
  };

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

  // `PortalScopeProvider` porte la classe `dark` ET ancre les portails Radix
  // (menus, ⌘K, dialogues, listes déroulantes, infobulles) sous elle : rendus
  // dans `document.body`, ils sortaient du sous-arbre thémé et s'affichaient en
  // clair sur une page sombre.
  return (
    <PortalScopeProvider className={cn(isDark && "dark")}>
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
                <React.Suspense
                  fallback={
                    <AppSidebar {...sidebarProps} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
                  }
                >
                  <SidebarAvecRecherche {...sidebarProps} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
                </React.Suspense>
              </div>
            </aside>

            {/* Navigation — tiroir sous lg */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetContent side="left" className="p-0">
                <SheetTitle className="sr-only">Navigation principale</SheetTitle>
                <React.Suspense
                  fallback={
                    <AppSidebar {...sidebarProps} collapsed={false} onNavigate={() => setMobileOpen(false)} />
                  }
                >
                  <SidebarAvecRecherche
                    {...sidebarProps}
                    collapsed={false}
                    onNavigate={() => setMobileOpen(false)}
                  />
                </React.Suspense>
              </SheetContent>
            </Sheet>

            <div className="flex min-w-0 flex-1 flex-col">
              <AppHeader
                nom={nom}
                role={role}
                majLe={majLe}
                loading={loading}
                messagesNonLus={counts.messagesNonLus ?? 0}
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
    </PortalScopeProvider>
  );
}
