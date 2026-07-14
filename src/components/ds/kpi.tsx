"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { fadeUp } from "@/lib/motion";
import { AnimatedNumber } from "@/components/ds/animated-number";
import { Card } from "@/components/ds/card";
import { Skeleton } from "@/components/ds/skeleton";

/**
 * Tuile KPI générique : un chiffre, sa légende, une micro-visualisation.
 *
 * Née dans le Centre de pilotage admin (`pilotage/KpiRow.tsx`), extraite ici
 * pour être réutilisée par les dashboards scopés par rôle (chefferie, etc.)
 * sans dupliquer la carte. `href` est optionnel : sans lien de destination
 * connu pour le rôle courant, la tuile se rend en `div` plutôt qu'en `Link`.
 */
export function Kpi({
  icon: Icon,
  label,
  href,
  loading,
  value,
  format,
  legende,
  tone = "neutral",
  children,
}: {
  icon: LucideIcon;
  label: string;
  href?: string;
  loading: boolean;
  value: number;
  format?: (n: number) => string;
  legende: React.ReactNode;
  tone?: "neutral" | "warning";
  children?: React.ReactNode;
}) {
  const contenu = (
    <>
      <div className="flex items-center gap-2">
        <Icon
          className={cn("size-3.5 shrink-0", tone === "warning" ? "text-warning" : "text-muted-foreground")}
          aria-hidden
        />
        <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">{label}</span>
        {href && (
          <ArrowUpRight className="ml-auto size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
        )}
      </div>

      {loading ? (
        <Skeleton className="mt-3 h-9 w-24" />
      ) : (
        <p
          className={cn(
            "mt-2.5 font-display text-[30px] leading-none font-extrabold tracking-tight",
            tone === "warning" ? "text-warning" : "text-foreground",
          )}
        >
          <AnimatedNumber value={value} format={format} />
        </p>
      )}

      {loading ? (
        <Skeleton className="mt-2.5 h-3.5 w-32" />
      ) : (
        <p className="mt-2 text-[12px] leading-snug text-muted-foreground">{legende}</p>
      )}

      <div className="mt-auto pt-4">{loading ? <Skeleton className="h-10" /> : children}</div>
    </>
  );

  return (
    <motion.div variants={fadeUp}>
      <Card className="group h-full">
        {href ? (
          <Link
            href={href}
            className="flex h-full flex-col rounded-xl p-5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            {contenu}
          </Link>
        ) : (
          <div className="flex h-full flex-col rounded-xl p-5">{contenu}</div>
        )}
      </Card>
    </motion.div>
  );
}
