"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium outline-none transition-[background-color,color,border-color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-panel",
        accent: "bg-accent text-accent-foreground hover:bg-accent/90 shadow-panel",
        outline: "border border-border bg-card text-foreground hover:bg-inset hover:border-border-strong",
        subtle: "bg-inset text-foreground hover:bg-border/60",
        ghost: "text-muted-foreground hover:bg-inset hover:text-foreground",
        danger: "bg-danger text-white hover:bg-danger/90 shadow-panel",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 rounded-md px-2.5 text-[13px]",
        md: "h-9 px-3.5",
        lg: "h-10 rounded-lg px-5",
        icon: "size-9 rounded-md",
        "icon-sm": "size-8 rounded-md",
      },
    },
    defaultVariants: { variant: "outline", size: "md" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Affiche un spinner et neutralise le bouton, sans changer sa largeur. */
    loading?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={asChild ? undefined : loading || props.disabled}
      aria-busy={loading || undefined}
      {...props}
    >
      {/* En `asChild`, on passe l'enfant SEUL : le `null` du spinner compterait
          comme un seconde enfant et Slot n'en accepte qu'un (« Slot failed to
          slot onto its children »). Le spinner n'a de toute façon pas de sens
          ici — c'est l'élément délégué qui porte son propre contenu. */}
      {asChild ? (
        children
      ) : (
        <>
          {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {children}
        </>
      )}
    </Comp>
  );
}

export { Button, buttonVariants };
