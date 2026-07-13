"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Panneau latéral — utilisé pour la navigation mobile (drawer). */
function Sheet(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger(props: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetContent({
  className,
  children,
  side = "left",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { side?: "left" | "right" }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          "fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        )}
      />
      <DialogPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "fixed inset-y-0 z-50 flex w-[17rem] flex-col bg-card shadow-float",
          "transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=open]:duration-300",
          side === "left"
            ? "left-0 border-r border-border data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left"
            : "right-0 border-l border-border data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="absolute top-4 right-4 rounded-md p-1.5 text-muted-foreground hover:bg-inset hover:text-foreground"
          aria-label="Fermer la navigation"
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

const SheetTitle = DialogPrimitive.Title;
const SheetDescription = DialogPrimitive.Description;

export { Sheet, SheetTrigger, SheetContent, SheetTitle, SheetDescription };
