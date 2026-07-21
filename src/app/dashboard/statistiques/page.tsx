"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { BarChart3, FileCheck2, Layers3, MapPin, Receipt, type LucideIcon } from "lucide-react";

import { stagger, fadeUp } from "@/lib/motion";
import { useStatistiques, type PointMois, type RangTerritoire } from "@/hooks/useStatistiques";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { useAncreFocus } from "@/hooks/useAncreFocus";

import { AppShell } from "@/components/pilotage/AppShell";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ds/card";
import { EmptyState } from "@/components/ds/empty-state";
import { Skeleton } from "@/components/ds/skeleton";
import { BarSeries } from "@/components/ds/spark";

const nf = new Intl.NumberFormat("fr-FR");
const pct = (n: number) => `${n < 10 ? n.toFixed(1).replace(".", ",") : Math.round(n)} %`;

/** Ancres des sous-entrées « Statistiques » de la barre latérale (cf. `?focus=`). */
const ANCRES = ["rapports", "performance"] as const;

/**
 * Statistiques nationales — rubrique « Statistiques » du handoff (Rapports et
 * Performance régionale).
 *
 * Écran de lecture seule : deux séries mensuelles et deux classements
 * territoriaux, tous dérivés de la base. Là où la base est encore muette
 * (aucune vente enregistrée), l'écran le dit — il ne comble pas.
 */
export default function StatistiquesPage() {
  const stats = useStatistiques();
  const { counts } = useBadgeCounts();
  useAncreFocus(ANCRES);

  return (
    <AppShell wide loading={stats.loading} counts={counts} onRefresh={stats.refresh}>
      <motion.div variants={stagger(0, 0.05)} initial="hidden" animate="show" className="flex flex-col gap-5">
        <div id="rapports" className="flex scroll-mt-24 flex-col gap-5">
        <SerieCard
          icon={Layers3}
          titre="Activité cadastrale"
          description="Lots enregistrés au cadastre, par mois sur douze mois"
          points={stats.cadastre}
          total={stats.totaux.cadastre}
          unite="lot"
          couleur="var(--chart-1)"
          loading={stats.loading}
        />

        <div className="grid gap-5 xl:grid-cols-2">
          <SerieCard
            icon={FileCheck2}
            titre="Actes de cession"
            description="Attestations émises, par mois sur douze mois"
            points={stats.actes}
            total={stats.totaux.actes}
            unite="acte"
            couleur="var(--chart-3)"
            loading={stats.loading}
          />
          <SerieCard
            icon={Receipt}
            titre="Transactions"
            description="Ventes enregistrées, par mois sur douze mois"
            points={stats.transactions}
            total={stats.totaux.transactions}
            unite="vente"
            couleur="var(--chart-2)"
            loading={stats.loading}
            vide={{
              titre: "Aucune vente enregistrée",
              texte:
                "Le registre des ventes est vide : la courbe apparaîtra dès la première transaction confirmée.",
            }}
          />
        </div>
        </div>

        <div id="performance" className="grid scroll-mt-24 gap-5 xl:grid-cols-2">
          <ClassementCard
            titre="Performance par district"
            description="Classement par taux d'occupation des lots"
            echelon="District"
            lignes={stats.districts}
            loading={stats.loading}
          />
          <ClassementCard
            titre="Performance par commune"
            description="Classement par taux d'occupation des lots"
            echelon="Commune"
            lignes={stats.communes}
            loading={stats.loading}
          />
        </div>

        {stats.error && (
          <p
            role="alert"
            className="rounded-lg border border-danger/30 bg-danger-subtle px-4 py-2.5 text-[13px] text-danger"
          >
            Certaines données n&apos;ont pas pu être chargées : {stats.error}
          </p>
        )}
      </motion.div>
    </AppShell>
  );
}

function SerieCard({
  icon: Icon,
  titre,
  description,
  points,
  total,
  unite,
  couleur,
  loading,
  vide,
}: {
  icon: LucideIcon;
  titre: string;
  description: string;
  points: PointMois[];
  total: number;
  unite: string;
  couleur: string;
  loading: boolean;
  vide?: { titre: string; texte: string };
}) {
  return (
    <motion.div variants={fadeUp}>
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <Icon className="size-4 text-primary" />
              {titre}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {!loading && (
            <span className="tabular text-[13px] font-semibold text-muted-foreground">
              {nf.format(total)} {unite}
              {total > 1 ? "s" : ""} sur la période
            </span>
          )}
        </CardHeader>

        <div className="px-5 pb-5">
          {loading ? (
            <Skeleton className="h-[120px]" />
          ) : total === 0 && vide ? (
            <EmptyState icon={Icon} title={vide.titre} description={vide.texte} />
          ) : (
            <BarSeries
              data={points}
              color={couleur}
              height={120}
              ariaLabel={`${titre} — ${points.map((p) => `${p.label} : ${p.value}`).join(", ")}`}
            />
          )}
        </div>
      </Card>
    </motion.div>
  );
}

function ClassementCard({
  titre,
  description,
  echelon,
  lignes,
  loading,
}: {
  titre: string;
  description: string;
  echelon: string;
  lignes: RangTerritoire[];
  loading: boolean;
}) {
  return (
    <motion.div variants={fadeUp}>
      <Card className="h-full">
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="size-4 text-primary" />
              {titre}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </CardHeader>

        <div className="px-5 pb-5">
          {loading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : lignes.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title={`Aucun ${echelon.toLowerCase()} renseigné`}
              description="Les lotissements enregistrés ne portent pas encore ce niveau de découpage territorial."
            />
          ) : (
            <ol className="flex flex-col gap-2">
              {lignes.map((ligne, i) => (
                <li
                  key={ligne.nom}
                  className="flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:border-primary/40"
                >
                  <span className="tabular flex size-7 shrink-0 items-center justify-center rounded-lg bg-inset text-[12.5px] font-bold text-primary">
                    {i + 1}
                  </span>

                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[13.5px] font-semibold text-foreground">{ligne.nom}</span>
                    <span className="truncate text-[11.5px] text-muted-2">
                      {ligne.detail || echelon} · {nf.format(ligne.lots)} lot{ligne.lots > 1 ? "s" : ""}
                    </span>
                  </span>

                  <span className="ml-auto flex shrink-0 flex-col items-end">
                    <span className="tabular text-[14px] font-bold text-foreground">{pct(ligne.taux)}</span>
                    <span className="tabular text-[11px] text-muted-2">
                      {nf.format(ligne.occupes)} occupé{ligne.occupes > 1 ? "s" : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
