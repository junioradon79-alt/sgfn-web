"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { FilePlus2, Landmark, LayoutGrid, MapPinPlus, Store, UserPlus, type LucideIcon } from "lucide-react";

import { fadeUp } from "@/lib/motion";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ds/card";

type Action = {
  icon: LucideIcon;
  titre: string;
  description: string;
  /** Soit une destination, soit un déclencheur — jamais les deux. */
  href?: string;
  onClick?: () => void;
};

/**
 * Raccourcis d'amorçage des six actes de création du système.
 *
 * Complète la palette ⌘K plutôt qu'elle ne la double : la palette suppose qu'on
 * sait déjà ce qu'on cherche, cette grille répond à « que puis-je créer ? ».
 * Chaque tuile pointe vers un écran qui existe — pas de raccourci décoratif.
 */
export function QuickActions({ onNouveauDossier }: { onNouveauDossier: () => void }) {
  const actions: Action[] = [
    {
      icon: FilePlus2,
      titre: "Nouveau dossier",
      description: "Ouvrir une demande ADU / ACD",
      onClick: onNouveauDossier,
    },
    {
      icon: MapPinPlus,
      titre: "Parcelles",
      description: "Enregistrer un lot au cadastre",
      href: "/dashboard/lots",
    },
    {
      icon: LayoutGrid,
      titre: "Îlots",
      description: "Structurer un périmètre",
      href: "/dashboard/ilots",
    },
    {
      icon: UserPlus,
      titre: "Nouvel utilisateur",
      description: "Inviter un profil ou un agent",
      href: "/dashboard/invitations",
    },
    {
      icon: Store,
      titre: "Nouvelle annonce",
      description: "Publier sur la marketplace",
      href: "/dashboard/mettre-en-vente",
    },
    {
      icon: Landmark,
      titre: "Attributaires",
      description: "Rattacher une personne à un lot",
      href: "/dashboard/attributaires",
    },
  ];

  return (
    <motion.div variants={fadeUp}>
      <Card className="h-full">
        <CardHeader>
          <div>
            <CardTitle>Actions rapides</CardTitle>
            <CardDescription>Les six actes de création du registre</CardDescription>
          </div>
        </CardHeader>

        <div className="grid gap-2.5 p-5 pt-0 sm:grid-cols-2">
          {actions.map((action) => (
            <ActionTile key={action.titre} action={action} />
          ))}
        </div>
      </Card>
    </motion.div>
  );
}

function ActionTile({ action }: { action: Action }) {
  const { icon: Icon, titre, description, href, onClick } = action;

  const contenu = (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-inset text-primary transition-colors group-hover:bg-accent-subtle">
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[13px] font-semibold text-foreground">{titre}</span>
        <span className="truncate text-[11.5px] text-muted-2">{description}</span>
      </span>
    </>
  );

  const classes =
    "group flex items-center gap-3 rounded-xl border border-border p-3 text-left transition-all outline-none hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_4px_10px_rgba(11,77,136,.10)] focus-visible:ring-2 focus-visible:ring-ring/50";

  return href ? (
    <Link href={href} className={classes}>
      {contenu}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={classes}>
      {contenu}
    </button>
  );
}
