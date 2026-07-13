"use client";

import { usePersistentState, useSystemDark } from "./usePersistentState";

export type ThemeChoice = "light" | "dark" | "system";

const CLE = "sgnf:theme";

function estThemeValide(v: string): v is ThemeChoice {
  return v === "light" || v === "dark" || v === "system";
}

/**
 * Thème du Centre de pilotage.
 *
 * Volontairement *scopé* : la classe `dark` est posée sur la racine du shell,
 * pas sur `<html>`. Les autres pages de la plateforme (encore écrites en
 * couleurs fixes) restent donc en clair et n'ont pas besoin d'être auditées.
 * Quand elles auront migré sur le Design System, il suffira de remonter la
 * classe d'un cran.
 */
export function useTheme() {
  const [choice, setTheme] = usePersistentState<ThemeChoice>(CLE, "system", estThemeValide);
  const systemDark = useSystemDark();

  const isDark = choice === "dark" || (choice === "system" && systemDark);

  return { choice, isDark, setTheme };
}
