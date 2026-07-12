"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Chargement de données au montage + rechargement manuel, sans setState
 * synchrone dans l'effet (pattern recommandé par react-hooks/set-state-in-effect).
 *
 * Le loader remplit lui-même les états de la page (setRows, setOptions, …) ;
 * le hook ne gère que l'indicateur de chargement et le cycle de vie.
 *
 * ```ts
 * const chargerLots = async () => { const { data } = await supabase...; setRows(data); };
 * const { isLoading, recharger } = useChargement(chargerLots);
 * // après une mutation : await recharger();
 * ```
 *
 * `actif` permet de différer le chargement (ex. attendre le profil admin) :
 * tant qu'il est false, rien n'est chargé et isLoading reste true.
 */
export function useChargement(
  loader: () => Promise<void>,
  deps: readonly unknown[] = [],
  actif: boolean = true
) {
  const [isLoading, setIsLoading] = useState(true);
  // Toujours la dernière version du loader, sans forcer l'effet à se réabonner
  // (mise à jour dans un effet : pas d'écriture de ref pendant le render).
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });

  const recharger = useCallback(async () => {
    setIsLoading(true);
    try {
      await loaderRef.current();
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!actif) return;
    let annule = false;
    (async () => {
      try {
        await loaderRef.current();
      } finally {
        if (!annule) setIsLoading(false);
      }
    })();
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actif, ...deps]);

  return { isLoading, recharger };
}
