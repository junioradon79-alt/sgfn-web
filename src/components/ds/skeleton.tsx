"use client";

import { cn } from "@/lib/utils";

/**
 * Squelette de chargement. Volontairement calibré sur la hauteur du contenu
 * réel pour qu'aucun décalage de mise en page ne survienne à l'arrivée des
 * données (CLS = 0).
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn("animate-pulse rounded-md bg-inset", className)}
      {...props}
    />
  );
}

export { Skeleton };
