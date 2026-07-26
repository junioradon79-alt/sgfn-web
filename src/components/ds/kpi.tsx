"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { fadeUp } from "@/lib/motion";
import { AnimatedNumber } from "@/components/ds/animated-number";
import { Card } from "@/components/ds/card";
import { Skeleton } from "@/components/ds/skeleton";

/**
 * Variation période à période affichée en pastille, en haut à droite de la tuile.
 *
 * `libelle` doit nommer la période comparée ("sur 30 j", "vs 30 j précédents") :
 * une pastille sans période comparée n'est pas interprétable. La tuile n'affiche
 * la pastille que si l'appelant a réellement de quoi calculer l'écart — on ne
 * met jamais un delta d'illustration (DS §1 : aucun chiffre inventé).
 */
export type KpiDelta = {
  /** Écart en %, signé. Positif = hausse. */
  pct: number;
  libelle: string;
  /** Une hausse n'est pas toujours une bonne nouvelle (litiges, impayés). */
  sens?: "hausse-favorable" | "hausse-defavorable";
};

/**
 * Tuile KPI générique : un chiffre, sa légende, une micro-visualisation.
 *
 * Née dans le Centre de pilotage admin (`pilotage/KpiRow.tsx`), extraite ici
 * pour être réutilisée par les dashboards scopés par rôle (chefferie, etc.)
 * sans dupliquer la carte. `href` est optionnel : sans lien de destination
 * connu pour le rôle courant, la tuile se rend en `div` plutôt qu'en `Link`.
 *
 * Anatomie alignée sur le handoff design du 18/07 : pastille d'icône 42px en
 * haut à gauche, delta optionnel en haut à droite, puis label → valeur →
 * légende → micro-visualisation.
 *
 * Trois tons, et la nuance entre les deux derniers est tout l'intérêt :
 * `warning` décrit un **état** (des brouillons, des lots sans coordonnées) —
 * l'ambre y reste juste ; `alert` dit « **on m'attend** », et n'a de sens que
 * sur une file non vide qui appelle une décision de l'utilisateur. Il reprend
 * la teinte de `Card tone="alert"` pour qu'une tuile et la carte qui porte la
 * même file ne s'écrivent pas en deux couleurs. À vide, toujours `neutral` :
 * une teinte permanente redevient un décor.
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
  delta,
  children,
}: {
  icon: LucideIcon;
  label: string;
  href?: string;
  loading: boolean;
  value: number;
  format?: (n: number) => string;
  legende: React.ReactNode;
  tone?: "neutral" | "warning" | "alert";
  delta?: KpiDelta;
  children?: React.ReactNode;
}) {
  const contenu = (
    <>
      <div className="flex items-start gap-2">
        <span
          className={cn(
            "flex size-[42px] shrink-0 items-center justify-center rounded-xl",
            // Sur le lavis brique, une pastille teintée se confondrait avec le
            // fond de la tuile (même écueil que dans `AlertCenter`) : c'est un
            // aplat plein qui porte le signal, comme la pastille compteur.
            tone === "alert" ? "bg-brick text-brick-foreground" : "bg-inset",
            tone === "warning" && "text-warning",
            tone === "neutral" && "text-primary",
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>

        <div className="ml-auto flex items-center gap-2">
          {delta && <DeltaPill delta={delta} />}
          {href && (
            <ArrowUpRight
              className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
              aria-hidden
            />
          )}
        </div>
      </div>

      {/* Sur le lavis brique, `muted-foreground` passe sous le seuil AA à 13 px :
          le libellé nomme la file, il doit se lire du premier coup d'œil. */}
      <p
        className={cn(
          "mt-4 text-[13px] font-medium",
          tone === "alert" ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </p>

      {loading ? (
        <Skeleton className="mt-1.5 h-9 w-24" />
      ) : (
        <p
          className={cn(
            "tabular mt-1 font-display text-[30px] leading-none font-extrabold tracking-tight",
            // En `alert` le chiffre reste en `text-foreground` : `text-brick` sur
            // le lavis brique tombe à 2,3:1 en thème sombre. C'est la surface qui
            // porte la teinte, pas le chiffre.
            tone === "warning" ? "text-warning" : "text-foreground",
          )}
        >
          <AnimatedNumber value={value} format={format} />
        </p>
      )}

      {loading ? (
        <Skeleton className="mt-2 h-3.5 w-32" />
      ) : (
        <p
          className={cn(
            "mt-1.5 text-[12px] leading-snug",
            // `muted-2` s'efface sur le lavis brique : la légende y dit ce qui est
            // attendu, elle doit rester lisible (même choix que `AlertCenter`).
            tone === "alert" ? "text-muted-foreground" : "text-muted-2",
          )}
        >
          {legende}
        </p>
      )}

      <div className="mt-auto pt-3.5">{loading ? <Skeleton className="h-10" /> : children}</div>
    </>
  );

  return (
    <motion.div variants={fadeUp}>
      <Card tone={tone === "alert" ? "alert" : "default"} className="group h-full">
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

/**
 * Pastille de variation. La couleur suit le *sens métier*, pas le signe : une
 * hausse des litiges se lit en rouge même si la flèche monte.
 */
function DeltaPill({ delta }: { delta: KpiDelta }) {
  const { pct, libelle, sens = "hausse-favorable" } = delta;
  const hausse = pct >= 0;
  const favorable = sens === "hausse-favorable" ? hausse : !hausse;
  const Fleche = hausse ? ArrowUpRight : ArrowDownRight;

  const texte = `${hausse ? "+" : "−"}${Math.abs(pct).toFixed(1).replace(".", ",")} %`;

  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-0.5 text-[13px] font-bold whitespace-nowrap",
        favorable ? "text-success" : "text-danger",
      )}
      title={`${texte} ${libelle}`}
    >
      <Fleche className="size-3.5" strokeWidth={2.4} aria-hidden />
      {texte}
      <span className="sr-only"> {libelle}</span>
    </span>
  );
}
