"use client";

import { cn } from "@/lib/utils";
import { useTheme } from "@/hooks/useTheme";
import { VitrineHeader } from "./VitrineHeader";
import { VitrineMain } from "./VitrineMain";
import { SiteFooter } from "./SiteFooter";

/**
 * Site Vitrine — page publique, reconstruite sur le handoff design (18/07).
 *
 * Le mode sombre reste *scopé* (classe `dark` posée ici, pas sur `<html>`) :
 * cohérent avec le reste de la plateforme, et sans effet sur les autres pages.
 * Les chiffres viennent de la base (cf. `usePublicStats` dans `VitrineMain`),
 * jamais des valeurs d'illustration du handoff.
 */
export function VitrineShell() {
  const { isDark } = useTheme();

  return (
    <div className={cn(isDark && "dark", "min-h-screen bg-background text-foreground")}>
      <VitrineHeader />
      <VitrineMain />
      <SiteFooter />
    </div>
  );
}
