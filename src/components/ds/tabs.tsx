"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" className={cn("flex flex-col", className)} {...props} />;
}

/** Onglets « segmented control » (Arc/Figma) : rail creusé, pilule active. */
function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      // `max-w-full` + défilement : au-delà de trois onglets, la barre dépasse
      // la largeur d'un téléphone. Sans ça, c'est la page entière qui se met à
      // défiler latéralement au lieu de la seule barre.
      className={cn(
        "scb inline-flex w-fit max-w-full items-center gap-0.5 overflow-x-auto rounded-lg bg-inset p-0.5",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        // `shrink-0` : dans une barre qui défile, un onglet garde sa largeur
        // plutôt que de se comprimer jusqu'à l'illisible.
        "inline-flex shrink-0 items-center gap-1.5 rounded-[calc(var(--radius)-4px)] px-2.5 py-1 text-[12.5px] font-semibold whitespace-nowrap transition-colors outline-none",
        "text-muted-foreground hover:text-foreground",
        "focus-visible:ring-2 focus-visible:ring-ring/50",
        "data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-panel",
        "[&_svg]:size-3.5 [&_svg]:pointer-events-none",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" className={cn("flex-1 outline-none", className)} {...props} />;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
