"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "./button";

/**
 * Un vide n'est pas une erreur.
 *
 * Le dashboard SGNF affiche beaucoup de zéros légitimes (0 litige = bonne
 * nouvelle ; 0 paiement = brique non encore ouverte). Le ton porte donc
 * l'information : `tone="positive"` dit « rien à faire, tout va bien »,
 * `tone="pending"` dit « ce n'est pas encore branché ».
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  tone = "neutral",
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  tone?: "neutral" | "positive" | "pending";
  action?: { label: string; onClick?: () => void; href?: string };
  className?: string;
}) {
  const ring = {
    neutral: "bg-inset text-muted-foreground",
    positive: "bg-success-subtle text-success",
    pending: "bg-warning-subtle text-warning",
  }[tone];

  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-10 text-center", className)}>
      <div className={cn("flex size-11 items-center justify-center rounded-full", ring)}>
        <Icon className="size-5" aria-hidden />
      </div>
      <p className="mt-3 text-[13.5px] font-semibold text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-[36ch] text-[12.5px] leading-relaxed text-muted-foreground">{description}</p>
      )}
      {action &&
        (action.href ? (
          <Button asChild variant="outline" size="sm" className="mt-4">
            <a href={action.href}>{action.label}</a>
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="mt-4" onClick={action.onClick}>
            {action.label}
          </Button>
        ))}
    </div>
  );
}
