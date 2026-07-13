"use client";

import * as React from "react";
import { animate, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";
import { DUR, EASE } from "@/lib/motion";

/**
 * Compte de la valeur précédente vers la nouvelle. Utilisé pour les KPI : le
 * mouvement du chiffre signale *qu'il a changé*, ce qu'un rendu statique ne dit
 * pas quand on revient sur l'onglet.
 *
 * Écrit dans le DOM via une ref plutôt qu'un state React : on évite ~60 rendus
 * par seconde et par KPI.
 */
export function AnimatedNumber({
  value,
  format = (n: number) => Math.round(n).toLocaleString("fr-FR"),
  className,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const from = React.useRef(0);
  const reduced = useReducedMotion();

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (reduced) {
      node.textContent = format(value);
      from.current = value;
      return;
    }

    const controls = animate(from.current, value, {
      duration: DUR.slow,
      ease: EASE,
      onUpdate: (n) => {
        node.textContent = format(n);
      },
    });
    from.current = value;
    return () => controls.stop();
  }, [value, format, reduced]);

  // La valeur finale est écrite en dur dans le HTML : elle reste correcte sans
  // JS et pour les lecteurs d'écran, qui ne doivent pas entendre le décompte.
  return (
    <span ref={ref} className={cn("tabular", className)}>
      {format(value)}
    </span>
  );
}
