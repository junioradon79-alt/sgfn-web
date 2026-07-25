"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ChevronRight,
  ClipboardCheck,
  ClipboardEdit,
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
import { CountBadge } from "@/components/ds/badge";
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

/**
 * Sur le lavis brique, les pastilles d'icône teintées (`bg-danger-subtle` &
 * consorts) se confondaient avec le fond : elles reposent donc sur la surface
 * blanche de la carte, et c'est l'icône seule qui porte la gravité. Le volume,
 * lui, est porté par un aplat plein (`CountBadge`) — un chiffre doit se lire
 * sans être déchiffré.
 */
const STYLE: Record<Gravite, { puce: string; pastille: "danger" | "warning" | "accent" }> = {
  critique: { puce: "text-danger", pastille: "danger" },
  attention: { puce: "text-warning", pastille: "warning" },
  info: { puce: "text-accent", pastille: "accent" },
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
 * elle est affichée comme telle — carte neutre, message vert.
 *
 * Dès qu'une file se remplit, la carte bascule en rouge brique (`tone="alert"`)
 * et chaque ligne porte sa pastille compteur. Les deux états sont donc lisibles
 * de loin et sans les lire : blanc = rien à faire, brique = on m'attend.
 */
export function AlertCenter({
  files,
  recettes,
  marketplaceARebuild,
  loading,
}: {
  files: AdminOverview["files"];
  recettes: AdminOverview["recettes"];
  marketplaceARebuild: boolean;
  loading: boolean;
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

    // L'alerte « attestations gratuites en attente » a été retirée le 22/07.
    // Elle offrait une action de masse depuis le tableau de bord, sans indiquer
    // le volume réel : après la purge du 21/07 elle proposait de régénérer 400
    // attestations d'un clic. Le rattrapage vit désormais au seul endroit où il
    // se comprend -- le Coffre-fort documentaire -- avec confirmation chiffrée
    // au-delà du seuil.

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
  }, [files, recettes, marketplaceARebuild]);

  // Le total porté par la pastille d'en-tête est le nombre de **dossiers**, pas
  // de lignes : trois lignes peuvent cacher quarante dossiers à traiter, et
  // c'est ce volume-là qui décide si l'on s'y met maintenant.
  const dossiers = alertes.reduce((n, a) => n + a.compte, 0);
  const enAlerte = !loading && alertes.length > 0;

  return (
    <motion.div variants={fadeUp} className="min-w-0">
      <Card tone={enAlerte ? "alert" : "default"} className="h-full">
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>Actions requises</CardTitle>
            <CardDescription>Ce qui attend une décision de l&apos;agence.</CardDescription>
          </div>
          <CardAction>
            {enAlerte && (
              <span className="flex items-center gap-2 text-[12px] font-semibold text-brick-foreground">
                <CountBadge tone="inverse" value={dossiers} />
                {dossiers > 1 ? "dossiers" : "dossier"}
              </span>
            )}
          </CardAction>
        </CardHeader>

        <div className="min-h-0 flex-1 px-2 pb-2 pt-2">
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
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-brick/15 bg-card">
                      <Icon className={cn("size-4", s.puce)} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-foreground">{a.titre}</span>
                      <span className="block truncate text-[12px] text-muted-foreground">{a.detail}</span>
                    </span>
                    <CountBadge tone={s.pastille} value={a.compte} />
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
                      className="group flex items-center gap-3 rounded-lg px-3 py-2.5 outline-none transition-colors hover:bg-brick/10 focus-visible:ring-2 focus-visible:ring-ring/50"
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
