"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { createClient } from "@/utils/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { fetchBadgeCounts, type BadgeKey } from "@/lib/navigation";

/**
 * Compteurs « à faire » de l'agence.
 *
 * Un seul appel réseau alimente à la fois les pastilles de la barre latérale et
 * le Centre d'alertes — sans quoi le même chiffre serait chargé deux fois et
 * pourrait diverger entre les deux endroits où il s'affiche.
 */
export function useBadgeCounts() {
  const { profile } = useProfile();
  const pathname = usePathname();
  const groupe = profile?.groupe ?? null;

  const [counts, setCounts] = useState<Partial<Record<BadgeKey, number>>>({});
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let annule = false;

    void (async () => {
      const next = await fetchBadgeCounts(createClient(), groupe);
      // Une réponse arrivée après un changement de rôle ou un démontage ne doit
      // pas écraser l'état courant.
      if (!annule) setCounts(next);
    })();

    return () => {
      annule = true;
    };
  }, [groupe, pathname, tick]);

  // Rafraîchissement immédiat après une action agence (event émis par les pages).
  useEffect(() => {
    const h = () => refresh();
    window.addEventListener("sgnf:refresh-badges", h);
    return () => window.removeEventListener("sgnf:refresh-badges", h);
  }, [refresh]);

  return { counts, refresh };
}
