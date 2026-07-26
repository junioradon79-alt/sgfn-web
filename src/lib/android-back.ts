"use client";

// Bouton et **geste** de retour Android.
//
// L'app native est une WebView sur une page unique (`/app.html`) : toute la
// navigation vit dans l'état React (onglet + calque), donc l'historique du
// navigateur est **vide**. Android ne voyant rien à dépiler, son geste de bord
// fermait l'application entière au lieu de revenir à l'écran précédent.
//
// Capacitor route le geste de bord ET le bouton système vers le même événement
// `backButton` du plugin `@capacitor/app` : un seul point d'écoute suffit.
//
// Le modèle est une **pile de gestionnaires** plutôt qu'un seul rappel : les
// écrans se superposent (calque au-dessus d'un onglet, au-dessus de la coquille)
// et c'est toujours le plus haut qui doit répondre en premier. Chaque
// gestionnaire renvoie `true` s'il a consommé le retour ; sinon on descend d'un
// cran. Si personne ne consomme, on est à la racine et l'application se ferme —
// mais seulement après une **confirmation**, une fermeture accidentelle en
// plein remplissage de formulaire étant coûteuse.
//
// No-op hors Capacitor natif (import dynamique du plugin, même patron que
// `biometric.ts` et le scanner ML Kit) : sur le web, le geste de bord du
// navigateur garde son sens propre.

import { useEffect, useRef } from "react";
import { isCapacitorNative } from "./capacitor";

/** Renvoie `true` si le retour a été consommé, `false` pour laisser passer. */
export type BackHandler = () => boolean;

const pile: BackHandler[] = [];
let listenerInstalle = false;
let demandeSortie: (() => void) | null = null;
let surConsommation: (() => void) | null = null;

function traiterRetour() {
  // Du plus récemment monté au plus ancien : le calque avant l'onglet.
  for (let i = pile.length - 1; i >= 0; i -= 1) {
    if (pile[i]()) {
      // Un retour consommé signifie qu'on a navigué : toute confirmation de
      // sortie en cours doit être désarmée, sinon un appui ultérieur à la
      // racine quitterait l'application sans avertissement visible.
      surConsommation?.();
      return;
    }
  }
  demandeSortie?.();
}

async function installerListener() {
  if (listenerInstalle || !isCapacitorNative()) return;
  listenerInstalle = true;
  try {
    const { App } = await import("@capacitor/app");
    await App.addListener("backButton", traiterRetour);
  } catch {
    // Plugin absent (build web, ou synchronisation native pas encore faite) :
    // l'app reste fonctionnelle, seul le geste retrouve son comportement natif.
    listenerInstalle = false;
  }
}

/**
 * Enregistre un gestionnaire de retour tant que le composant est monté.
 *
 * `actif` permet de le neutraliser sans démonter (un onglet qui n'est pas au
 * premier plan ne doit pas répondre) — et le garder dans la pile préserve
 * l'ordre : le retirer puis le remettre le ferait remonter au sommet.
 */
export function useBackHandler(handler: BackHandler, actif = true) {
  // Une ref stable évite de dépiler/rempiler à chaque rendu, ce qui
  // réordonnerait la pile au gré des re-rendus du parent. Elle se met à jour
  // dans un effet et non pendant le rendu : écrire une ref pendant le rendu
  // casse la garantie de pureté que React exige (et que le lint fait respecter).
  const ref = useRef(handler);
  const actifRef = useRef(actif);
  useEffect(() => {
    ref.current = handler;
    actifRef.current = actif;
  });

  useEffect(() => {
    const entree: BackHandler = () => (actifRef.current ? ref.current() : false);
    pile.push(entree);
    void installerListener();
    return () => {
      const i = pile.indexOf(entree);
      if (i >= 0) pile.splice(i, 1);
    };
  }, []);
}

/**
 * Fenêtre de confirmation d'un retour sur formulaire. Calée sur la durée du
 * toast qui la porte (`TOAST_MS` dans MobileApp) : désynchronisées, le message
 * « appuyez à nouveau » survivrait à l'armement qu'il annonce, et le second
 * appui ne ferait que réarmer sous les yeux de quelqu'un qui croit confirmer.
 */
const FENETRE_CONFIRMATION_MS = 2800;

/**
 * Retour sur un écran qui porte une **saisie en cours**.
 *
 * Le geste de bord se déclenche d'un frôlement, sans intention : sur un
 * formulaire à moitié rempli il coûte tout ce qui a été tapé. On reprend donc
 * la grammaire déjà posée à la racine par la sortie d'application — un premier
 * geste consommé qui prévient par un toast, un second qui laisse passer —
 * plutôt qu'une boîte de dialogue, forme qui n'existe nulle part ailleurs dans
 * l'app et qu'il faudrait styler, piéger au clavier et refermer.
 *
 * Le second geste ne referme **pas** l'écran lui-même : il renvoie `false` et
 * laisse le calque parent décider où revenir (le signalement retourne au détail
 * de sa parcelle, pas à la liste). Un écran qui se fermerait tout seul
 * dupliquerait cette règle de navigation et finirait par en diverger.
 *
 * Rien de saisi ⇒ aucun frein : le retour passe du premier coup.
 *
 * ⚠️ Ne couvre que le geste/bouton système. La flèche de la barre de titre
 * reste immédiate : c'est une visée délibérée, pas un réflexe de bord.
 */
export function useRetourFormulaire(saisieEnCours: boolean, avertir: () => void) {
  const arme = useRef(false);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (minuteur.current) clearTimeout(minuteur.current);
    },
    [],
  );

  useBackHandler(() => {
    // Déjà averti : on laisse filer vers le calque parent, qui referme.
    if (!saisieEnCours || arme.current) return false;
    arme.current = true;
    avertir();
    minuteur.current = setTimeout(() => {
      arme.current = false;
    }, FENETRE_CONFIRMATION_MS);
    return true;
  });
}

/**
 * Branche la sortie d'application, appelée quand aucun écran n'a consommé le
 * retour. Confiée à la coquille, seule à disposer du toast de confirmation.
 */
export function useSortieApplication(onDemandeSortie: () => void) {
  const ref = useRef(onDemandeSortie);
  useEffect(() => {
    ref.current = onDemandeSortie;
  });
  useEffect(() => {
    demandeSortie = () => ref.current();
    void installerListener();
    return () => {
      demandeSortie = null;
    };
  }, []);
}

/**
 * Notifie que le retour a été **consommé** par un écran. Sert à annuler une
 * confirmation de sortie en attente : sans cela, l'armement survivrait à une
 * navigation et l'appui suivant à la racine quitterait sans avertissement.
 */
export function useBackConsomme(onConsomme: () => void) {
  const ref = useRef(onConsomme);
  useEffect(() => {
    ref.current = onConsomme;
  });
  useEffect(() => {
    surConsommation = () => ref.current();
    return () => {
      surConsommation = null;
    };
  }, []);
}

/** Ferme réellement l'application (aucun effet hors natif). */
export async function quitterApplication() {
  if (!isCapacitorNative()) return;
  try {
    const { App } = await import("@capacitor/app");
    await App.exitApp();
  } catch {
    /* plugin indisponible */
  }
}
