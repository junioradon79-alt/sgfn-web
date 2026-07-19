"use client";

import * as React from "react";

const CLE = "sgnf.nav.favoris";

/** Référence stable pour le rendu serveur et les cas sans localStorage. */
const VIDE: string[] = [];

/**
 * `useSyncExternalStore` exige un instantané *stable* : renvoyer un tableau
 * fraîchement parsé à chaque appel ferait boucler le rendu. On mémorise donc le
 * dernier JSON brut lu, et on ne re-parse que s'il a changé.
 */
let dernierBrut: string | null = null;
let dernierParse: string[] = VIDE;

const abonnes = new Set<() => void>();

function lire(): string[] {
  let brut: string | null = null;
  try {
    brut = window.localStorage.getItem(CLE);
  } catch {
    return VIDE; // mode privé, quota, stockage désactivé
  }

  if (brut === dernierBrut) return dernierParse;
  dernierBrut = brut;

  try {
    const lu: unknown = brut ? JSON.parse(brut) : [];
    dernierParse = Array.isArray(lu) ? lu.filter((h): h is string => typeof h === "string") : VIDE;
  } catch {
    dernierParse = VIDE;
  }
  return dernierParse;
}

function ecrire(hrefs: string[]) {
  try {
    window.localStorage.setItem(CLE, JSON.stringify(hrefs));
  } catch {
    // Épinglage perdu au rechargement, mais l'écran reste utilisable.
  }
  abonnes.forEach((notifier) => notifier());
}

function abonner(notifier: () => void) {
  abonnes.add(notifier);
  // `storage` ne se déclenche que dans les *autres* onglets : c'est ce qui garde
  // deux fenêtres du dashboard d'accord entre elles.
  window.addEventListener("storage", notifier);
  return () => {
    abonnes.delete(notifier);
    window.removeEventListener("storage", notifier);
  };
}

/**
 * Entrées de menu épinglées par l'utilisateur (rubrique « Favoris » du handoff).
 *
 * Stockage local, volontairement : un favori est une commodité d'affichage
 * propre à un poste de travail, pas une donnée métier — rien ici ne justifie un
 * aller-retour serveur ni une colonne en base.
 */
export function useNavFavoris() {
  const favoris = React.useSyncExternalStore(abonner, lire, () => VIDE);

  const basculer = React.useCallback((href: string) => {
    const actuels = lire();
    ecrire(actuels.includes(href) ? actuels.filter((h) => h !== href) : [...actuels, href]);
  }, []);

  const estFavori = React.useCallback((href: string) => favoris.includes(href), [favoris]);

  return { favoris, basculer, estFavori };
}
