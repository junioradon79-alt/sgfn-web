"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ChevronRight,
  ClipboardCheck,
  ClipboardEdit,
  FileCheck2,
  FileWarning,
  ReceiptText,
  ShieldCheck,
  Store,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { fadeUp, stagger } from "@/lib/motion";
import type { AdminOverview } from "@/hooks/useAdminOverview";
import { Card, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ds/card";
import { Badge } from "@/components/ds/badge";
import { Button } from "@/components/ds/button";
import { EmptyState } from "@/components/ds/empty-state";
import { Skeleton } from "@/components/ds/skeleton";

type Gravite = "critique" | "attention" | "info";

/** Une alerte navigue vers un registre (`href`), sauf si elle porte sa propre action (`onAction`) : c'est le seul cas où toute la ligne n'est pas un lien. */
type Alerte = {
  id: string;
  icon: LucideIcon;
  gravite: Gravite;
  titre: string;
  detail: string;
  compte: number;
} & ({ href: string; onAction?: undefined } | { href?: undefined; onAction: () => void; enCours: boolean });

const STYLE: Record<Gravite, { puce: string; fond: string; badge: "danger" | "warning" | "accent" }> = {
  critique: { puce: "text-danger", fond: "bg-danger-subtle", badge: "danger" },
  attention: { puce: "text-warning", fond: "bg-warning-subtle", badge: "warning" },
  info: { puce: "text-accent", fond: "bg-accent-subtle", badge: "accent" },
};

const ORDRE: Record<Gravite, number> = { critique: 0, attention: 1, info: 2 };

/**
 * Centre d'alertes.
 *
 * Une seule règle de tri : ce qui exige *notre* action passe avant ce qui
 * dépend d'un tiers. C'est la même convention que les pastilles rouges du menu
 * (`actionAgenceRequise`) — un signal ne peut pas vouloir dire deux choses
 * différentes selon l'endroit où il s'affiche.
 *
 * L'absence d'alerte n'est pas un vide à combler : c'est une information, et
 * elle est affichée comme telle.
 */
export function AlertCenter({
  files,
  recettes,
  marketplaceARebuild,
  loading,
  onGenererAttestations,
  genererAttestationsEnCours,
}: {
  files: AdminOverview["files"];
  recettes: AdminOverview["recettes"];
  marketplaceARebuild: boolean;
  loading: boolean;
  onGenererAttestations: () => void;
  genererAttestationsEnCours: boolean;
}) {
  const alertes = React.useMemo<Alerte[]>(() => {
    const out: Alerte[] = [];

    if (files.demandesATraiter > 0)
      out.push({
        id: "demandes",
        icon: ClipboardCheck,
        gravite: "critique",
        titre: `${files.demandesATraiter} demande${files.demandesATraiter > 1 ? "s" : ""} d'acquisition`,
        detail: "Le tunnel de vente attend une action de l'agence.",
        href: "/dashboard/demandes-acquisition",
        compte: files.demandesATraiter,
      });

    if (files.litigesOuverts > 0)
      out.push({
        id: "litiges",
        icon: FileWarning,
        gravite: "critique",
        titre: `${files.litigesOuverts} litige${files.litigesOuverts > 1 ? "s" : ""} ouvert${files.litigesOuverts > 1 ? "s" : ""}`,
        detail: "Dossiers en attente de médiation.",
        href: "/dashboard/litiges",
        compte: files.litigesOuverts,
      });

    if (files.saisieAValider > 0)
      out.push({
        id: "saisie",
        icon: ClipboardEdit,
        gravite: "attention",
        titre: `${files.saisieAValider} soumission${files.saisieAValider > 1 ? "s" : ""} à valider`,
        detail: "Saisies en attente de double validation.",
        href: "/dashboard/saisie",
        compte: files.saisieAValider,
      });

    if (files.attestationsGratuitesEnAttente > 0)
      out.push({
        id: "attestations-gratuites",
        icon: FileCheck2,
        gravite: "attention",
        titre: `${files.attestationsGratuitesEnAttente} attestation${files.attestationsGratuitesEnAttente > 1 ? "s" : ""} gratuite${files.attestationsGratuitesEnAttente > 1 ? "s" : ""} en attente`,
        detail: "Attribution déjà enregistrée, jamais génératrice d'attestation (import fait trigger désactivé).",
        onAction: onGenererAttestations,
        enCours: genererAttestationsEnCours,
        compte: files.attestationsGratuitesEnAttente,
      });

    if (recettes.enAttente > 0)
      out.push({
        id: "paiements",
        icon: ReceiptText,
        gravite: "attention",
        titre: `${recettes.enAttente} paiement${recettes.enAttente > 1 ? "s" : ""} à encaisser`,
        detail: "Règlements guichet en attente de validation.",
        href: "/dashboard/paiements",
        compte: recettes.enAttente,
      });

    if (files.dossiersAduEnCours > 0)
      out.push({
        id: "adu",
        icon: ClipboardCheck,
        gravite: "info",
        titre: `${files.dossiersAduEnCours} dossier${files.dossiersAduEnCours > 1 ? "s" : ""} ADU en cours`,
        detail: "Instruction et pièces à suivre.",
        href: "/dashboard/dossiers-adu",
        compte: files.dossiersAduEnCours,
      });

    if (marketplaceARebuild)
      out.push({
        id: "marketplace",
        icon: Store,
        gravite: "info",
        titre: "Site TerraCI Market à reconstruire",
        detail: "Une annonce a été publiée depuis le dernier déploiement.",
        href: "/dashboard/contacts-marketplace",
        compte: 1,
      });

    return out.sort((a, b) => ORDRE[a.gravite] - ORDRE[b.gravite]);
  }, [files, recettes, marketplaceARebuild, onGenererAttestations, genererAttestationsEnCours]);

  const critiques = alertes.filter((a) => a.gravite === "critique").length;

  return (
    <motion.div variants={fadeUp} className="min-w-0">
      <Card className="h-full">
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>Actions requises</CardTitle>
            <CardDescription>Ce qui attend une décision de l&apos;agence.</CardDescription>
          </div>
          <CardAction>
            {!loading && alertes.length > 0 && (
              <Badge tone={critiques > 0 ? "danger" : "warning"}>
                {alertes.length} en attente
              </Badge>
            )}
          </CardAction>
        </CardHeader>

        <div className="min-h-0 flex-1 px-2 pb-2">
          {loading ? (
            <div className="space-y-1.5 px-3 pb-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : alertes.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              tone="positive"
              title="Aucune action requise"
              description="Aucun litige, aucune demande en attente, aucune saisie à valider. Le foncier est à jour."
            />
          ) : (
            <motion.ul variants={stagger(0.05, 0.04)} initial="hidden" animate="show" className="space-y-0.5">
              {alertes.map((a) => {
                const s = STYLE[a.gravite];
                const Icon = a.icon;
                const contenu = (
                  <>
                    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", s.fond)}>
                      <Icon className={cn("size-4", s.puce)} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-foreground">{a.titre}</span>
                      <span className="block truncate text-[12px] text-muted-foreground">{a.detail}</span>
                    </span>
                  </>
                );

                if (a.onAction) {
                  return (
                    <motion.li key={a.id} variants={fadeUp}>
                      <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
                        {contenu}
                        <Button
                          variant="outline"
                          size="sm"
                          loading={a.enCours}
                          onClick={a.onAction}
                          className="shrink-0"
                        >
                          {a.enCours ? "Génération…" : "Générer"}
                        </Button>
                      </div>
                    </motion.li>
                  );
                }

                return (
                  <motion.li key={a.id} variants={fadeUp}>
                    <Link
                      href={a.href}
                      className="group flex items-center gap-3 rounded-lg px-3 py-2.5 outline-none transition-colors hover:bg-inset focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      {contenu}
                      <ChevronRight
                        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </Link>
                  </motion.li>
                );
              })}
            </motion.ul>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
