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
        "flex items-start justify-between gap-4 px-5 pt-5 pb-4 has-data-[slot=card-action]:items-center",
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

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-action" className={cn("flex shrink-0 items-center gap-1.5", className)} {...props} />
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
