"use client";

import * as React from "react";

/**
 * Point d'ancrage des portails Radix à l'intérieur du sous-arbre thémé.
 *
 * Le mode sombre est *scopé* : `globals.css` déclare
 * `@custom-variant dark (&:is(.dark *))`, et la classe `.dark` est posée par
 * `AppShell` sur un div, jamais sur `<html>` (cf. `useTheme`) — pour que les
 * pages pas encore migrées restent en clair sans audit.
 *
 * Or Radix rend ses portails dans `document.body`, donc *hors* de ce div : le
 * sélecteur `.dark *` ne les atteint pas. Mesuré au navigateur sur le Centre de
 * pilotage en sombre : le menu de thème sortait en `rgb(255,255,255)` sur
 * `rgb(15,23,42)` de texte — un panneau blanc sur une page « encre de nuit ».
 * Le défaut touchait tous les portails (menus, ⌘K, boîtes de dialogue, listes
 * déroulantes, infobulles) et passait inaperçu parce qu'une capture d'écran
 * n'ouvre jamais de menu.
 *
 * On donne donc aux portails un conteneur qui vit *dans* le sous-arbre thémé :
 * l'héritage CSS redevient celui qu'on croyait avoir, sans toucher au principe
 * du thème scopé. Hors `AppShell` (pages legacy, pages publiques), le contexte
 * est vide et Radix retombe sur `document.body` — c'est-à-dire le mode clair,
 * qui est exactement ce que ces pages attendent.
 */
const PortalScopeContext = React.createContext<HTMLElement | null>(null);

/** Conteneur à passer à `<XPrimitive.Portal container={…}>`. */
export function usePortalContainer(): HTMLElement | undefined {
  return React.useContext(PortalScopeContext) ?? undefined;
}

/**
 * Rend lui-même l'élément qui porte le thème (`className="dark"`) et y ancre le
 * conteneur des portails. Le fournisseur *est* la frontière du thème : on ne
 * peut donc pas le placer par erreur à côté de la classe plutôt qu'en dessous,
 * ce qui ramènerait exactement le défaut qu'il corrige.
 */
export function PortalScopeProvider({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  // `useState` plutôt qu'un `useRef` : il faut re-rendre une fois le nœud monté,
  // sinon les portails du premier rendu partiraient encore dans `document.body`.
  const [noeud, setNoeud] = React.useState<HTMLElement | null>(null);

  return (
    <div className={className}>
      <PortalScopeContext.Provider value={noeud}>
        {children}
        {/* Boîte sans dimension ni style : elle n'accueille que des éléments
            positionnés (fixed / absolute) et ne crée aucun contexte
            d'empilement. */}
        <div ref={setNoeud} data-slot="portal-scope" />
      </PortalScopeContext.Provider>
    </div>
  );
}
