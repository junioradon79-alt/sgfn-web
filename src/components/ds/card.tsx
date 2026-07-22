"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Surface de base du Design System. Toute donnée affichée dans le dashboard vit
 * dans un `Card` — c'est la seule primitive autorisée à porter une ombre.
 */
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "flex flex-col rounded-xl border border-border bg-card text-foreground shadow-panel",
        className,
      )}
      {...props}
    />
  );
}

/** En-tête : titre + description à gauche, actions à droite (via `CardAction`). */
function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        // `flex-wrap` : sur mobile, titre et actions (onglets, boutons) ne tiennent
        // pas côte à côte — sans lui, le titre se comprime jusqu'à s'écrire à la
        // verticale. Les actions passent sous le titre plutôt que de l'écraser.
        "flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-5 pb-4 has-data-[slot=card-action]:items-center",
        className,
      )}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="card-title"
      className={cn("font-display text-[15px] leading-tight font-bold tracking-tight", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="card-description"
      className={cn("mt-1 text-[13px] leading-snug text-muted-foreground", className)}
      {...props}
    />
  );
}

/**
 * Actions d'en-tête (onglets, boutons).
 *
 * `shrink-0` empêche les boutons d'être compressés quand ils tiennent à côté du
 * titre. Mais seul, il faisait déborder la page : une fois passé à la ligne par
 * le `flex-wrap` de `CardHeader`, le bloc restait dimensionné à son contenu —
 * les onglets dynamiques du Centre d'activité mesurent 577 px — et poussait le
 * document 262 px au-delà de l'écran sur un téléphone. Le `max-w-full` des
 * `TabsList` ne servait à rien, se mesurant contre ce parent trop large.
 * `min-w-0 max-w-full` le borne à la carte : le défilement horizontal interne
 * des onglets s'enclenche enfin, au lieu de déporter toute la page.
 */
function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("flex max-w-full min-w-0 shrink-0 items-center gap-1.5", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("px-5 pb-5", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center gap-3 border-t border-border px-5 py-3.5", className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, CardFooter };
