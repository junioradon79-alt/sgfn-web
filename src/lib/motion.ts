import type { Transition, Variants } from "framer-motion";

/**
 * Système d'animation SGNF.
 *
 * Trois règles, valables partout :
 *   1. Le mouvement *informe*, il ne décore pas. On n'anime qu'une entrée de
 *      contenu, un changement d'état ou une transition de valeur.
 *   2. Une seule famille de courbes. `ease` ci-dessous est la courbe standard ;
 *      `spring` est réservé aux éléments que l'utilisateur manipule (pilule
 *      active, poignée, panneau).
 *   3. Rien ne dure plus de 400 ms. Au-delà, l'interface paraît lente.
 *
 * L'accessibilité est traitée en amont : `AppShell` monte un `<MotionConfig
 * reducedMotion="user">`, donc chaque variant ci-dessous est automatiquement
 * neutralisé quand l'OS demande « moins d'animations ». Ne pas re-tester
 * `prefers-reduced-motion` dans les composants.
 */

export const DUR = {
  fast: 0.15,
  base: 0.24,
  slow: 0.36,
} as const;

/** Courbe standard (decelerate) — sortie franche, arrivée douce. */
export const EASE = [0.22, 0.61, 0.36, 1] as const;

export const ease: Transition = { duration: DUR.base, ease: EASE };

/** Ressort discret, pour ce que l'utilisateur « pousse ». */
export const spring: Transition = { type: "spring", stiffness: 420, damping: 34, mass: 0.7 };

/** Entrée d'un panneau : monte de 8px en s'opacifiant. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: ease },
};

/** Entrée latérale — lignes de liste, éléments de fil d'activité. */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: ease },
};

/**
 * Conteneur qui décale l'entrée de ses enfants. 40 ms suffisent à donner une
 * direction de lecture ; au-delà, la dernière carte se fait attendre.
 */
export const stagger = (delayChildren = 0, staggerChildren = 0.04): Variants => ({
  hidden: {},
  show: { transition: { delayChildren, staggerChildren } },
});

/** Overlay (feuille latérale, popover custom). */
export const overlay: Variants = {
  hidden: { opacity: 0, scale: 0.98 },
  show: { opacity: 1, scale: 1, transition: { duration: DUR.fast, ease: EASE } },
  exit: { opacity: 0, scale: 0.98, transition: { duration: DUR.fast, ease: EASE } },
};
