"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * État persisté dans `localStorage`, lu via `useSyncExternalStore`.
 *
 * Pourquoi pas un `useState` + `useEffect` de lecture ? Parce que l'application
 * est exportée en statique : le HTML est produit au build, sans `window`. Lire
 * la préférence dans un effet provoque un premier rendu « par défaut » suivi
 * d'un second — soit un scintillement, soit un écart d'hydratation.
 * `useSyncExternalStore` traite `localStorage` pour ce qu'il est : une source
 * extérieure à React, avec un instantané serveur explicite.
 */

const EVENT = "sgnf:storage";

function subscribe(onChange: () => void) {
  // `storage` couvre les autres onglets ; l'event maison couvre celui-ci.
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

export function usePersistentState<T extends string>(
  cle: string,
  defaut: T,
  estValide: (v: string) => v is T = ((v: string) => typeof v === "string") as (v: string) => v is T,
): [T, (v: T) => void] {
  const valeur = useSyncExternalStore(
    subscribe,
    () => {
      const brut = window.localStorage.getItem(cle);
      return brut !== null && estValide(brut) ? brut : defaut;
    },
    () => defaut,
  );

  const definir = useCallback(
    (v: T) => {
      window.localStorage.setItem(cle, v);
      window.dispatchEvent(new Event(EVENT));
    },
    [cle],
  );

  return [valeur, definir];
}

/** Préférence de thème du système d'exploitation, sans effet ni état local. */
export function useSystemDark(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    () => false,
  );
}
