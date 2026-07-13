"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11.5px] font-semibold [&_svg]:size-3 [&_svg]:pointer-events-none",
  {
    variants: {
      tone: {
        neutral: "border-border bg-inset text-muted-foreground",
        accent: "border-transparent bg-accent-subtle text-accent",
        success: "border-transparent bg-success-subtle text-success",
        warning: "border-transparent bg-warning-subtle text-warning",
        danger: "border-transparent bg-danger-subtle text-danger",
        outline: "border-border-strong bg-transparent text-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

function Badge({
  className,
  tone,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";
  return <Comp data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props} />;
}

/** Pastille de statut : point coloré + libellé, pour les tableaux denses. */
function StatusDot({ tone = "neutral", className }: { tone?: "neutral" | "accent" | "success" | "warning" | "danger"; className?: string }) {
  const color = {
    neutral: "bg-muted-foreground",
    accent: "bg-accent",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
  }[tone];
  return <span aria-hidden className={cn("inline-block size-1.5 shrink-0 rounded-full", color, className)} />;
}

export { Badge, badgeVariants, StatusDot };
