"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { isCapacitorNative, toFlatHtmlPath } from "@/lib/capacitor";

/**
 * Navigation vers une page « web » (dashboard, vérifier, profil complet…) depuis
 * l'app mobile. En natif, on charge le FICHIER PLAT dans la même WebView (session
 * conservée, retour Android → app). Sur le web, navigation SPA normale.
 */
export function useWebNav() {
  const router = useRouter();
  return useCallback(
    (path: string) => {
      if (isCapacitorNative()) {
        window.location.assign(toFlatHtmlPath(path));
      } else {
        router.push(path);
      }
    },
    [router]
  );
}
