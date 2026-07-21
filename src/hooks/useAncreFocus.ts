"use client";

import { useEffect } from "react";

/**
 * Défilement vers une section au montage, d'après `?focus=<id>` dans l'URL.
 *
 * Sert aux rubriques que le handoff éclate en plusieurs liens alors qu'elles
 * sont des sections d'une même page : Pilotage → « Centre d'alertes » /
 * « Activité temps réel », Statistiques → « Performance régionale ». La
 * sous-entrée de la barre latérale navigue vers `?focus=<id>` ; la page amène
 * l'ancre correspondante à l'écran.
 *
 * Lu au montage uniquement — pas via `useSearchParams`, qui imposerait un
 * `<Suspense>` de page en export statique. Passer une référence `ids` stable
 * (constante de module) pour que l'effet ne se relance pas à chaque rendu.
 */
export function useAncreFocus(ids: readonly string[]) {
  useEffect(() => {
    const focus = new URLSearchParams(window.location.search).get("focus");
    if (!focus || !ids.includes(focus)) return;
    // Laisse la première peinture poser la mise en page avant de défiler.
    const t = window.setTimeout(() => {
      document.getElementById(focus)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => window.clearTimeout(t);
  }, [ids]);
}
