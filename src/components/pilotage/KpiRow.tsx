"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Banknote, FileCheck2, Layers3, Satellite, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { fadeUp, stagger } from "@/lib/motion";
import type { AdminOverview } from "@/hooks/useAdminOverview";
import { AnimatedNumber } from "@/components/ds/animated-number";
import { Card } from "@/components/ds/card";
import { CompositionBar, Sparkline } from "@/components/ds/spark";
import { Skeleton } from "@/components/ds/skeleton";

const nf = new Intl.NumberFormat("fr-FR");
const fcfa = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(".", ",")} M` : nf.format(Math.round(n));

/**
 * Bloc KPI.
 *
 * Quatre indicateurs, pas six : chacun répond à une question que se pose un
 * pilote national — que possède-t-on, sait-on où c'est, que produit-on, que
 * perçoit-on. Un cinquième chiffre n'aurait ajouté qu'un balayage de plus.
 *
 * Chaque carte porte sa propre micro-visualisation : le chiffre dit le niveau,
 * la courbe dit la direction. L'un sans l'autre ne décide rien.
 */
function Kpi({
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
  href: string;
  loading: boolean;
  value: number;
  format?: (n: number) => string;
  legende: React.ReactNode;
  tone?: "neutral" | "warning";
  children?: React.ReactNode;
}) {
  return (
    <motion.div variants={fadeUp}>
      <Card className="group h-full">
        <Link
          href={href}
          className="flex h-full flex-col rounded-xl p-5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <div className="flex items-center gap-2">
            <Icon
              className={cn("size-3.5 shrink-0", tone === "warning" ? "text-warning" : "text-muted-foreground")}
              aria-hidden
            />
            <span className="text-[11px] font-bold tracking-wider text-muted-foreground uppercase">{label}</span>
            <ArrowUpRight className="ml-auto size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
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
        </Link>
      </Card>
    </motion.div>
  );
}

export function KpiRow({
  patrimoine,
  couverture,
  actes,
  recettes,
  loading,
}: {
  patrimoine: AdminOverview["patrimoine"];
  couverture: AdminOverview["couverture"];
  actes: AdminOverview["actes"];
  recettes: AdminOverview["recettes"];
  loading: boolean;
}) {
  const tauxCouverture = couverture.taux;
  const sansCoords = patrimoine.lots - couverture.lotsGeolocalises;

  return (
    <motion.section
      variants={stagger(0, 0.05)}
      initial="hidden"
      animate="show"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      aria-label="Indicateurs clés"
    >
      <Kpi
        icon={Layers3}
        label="Patrimoine foncier"
        href="/dashboard/lots"
        loading={loading}
        value={patrimoine.lots}
        legende={
          <>
            {nf.format(patrimoine.ilots)} îlots · {nf.format(patrimoine.lotissements)} périmètres ·{" "}
            {nf.format(patrimoine.attributaires)} attributaires
          </>
        }
      >
        <div>
          <CompositionBar
            segments={[
              { key: "occ", label: "Occupés", value: patrimoine.occupes, color: "var(--chart-1)" },
              { key: "lib", label: "Libres", value: patrimoine.libres, color: "var(--chart-3)" },
              { key: "lit", label: "En litige", value: patrimoine.enLitige, color: "var(--danger)" },
            ]}
          />
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>
              <b className="text-foreground tabular">{nf.format(patrimoine.occupes)}</b> occupés
            </span>
            <span>
              <b className="text-success tabular">{nf.format(patrimoine.libres)}</b> libres
            </span>
          </div>
        </div>
      </Kpi>

      <Kpi
        icon={Satellite}
        label="Couverture GPS"
        href="/dashboard/carte"
        loading={loading}
        value={tauxCouverture}
        format={(n) => `${n < 1 ? n.toFixed(1).replace(".", ",") : Math.round(n)} %`}
        tone={sansCoords > 0 ? "warning" : "neutral"}
        legende={
          sansCoords > 0 ? (
            <>
              {nf.format(sansCoords)} lots sans coordonnées — le registre existe, sa carte non
            </>
          ) : (
            <>Tous les lots sont positionnés</>
          )
        }
      >
        {/* Une jauge, pas une courbe : la couverture est un état, pas une tendance. */}
        <div>
          <CompositionBar
            segments={[
              { key: "geo", label: "Géolocalisés", value: couverture.lotsGeolocalises, color: "var(--warning)" },
              { key: "non", label: "Sans coordonnées", value: sansCoords, color: "var(--border)" },
            ]}
          />
          <div className="mt-2 text-[11px] text-muted-foreground">
            <b className="text-foreground tabular">{nf.format(couverture.lotsGeolocalises)}</b> lot
            {couverture.lotsGeolocalises > 1 ? "s" : ""} positionné{couverture.lotsGeolocalises > 1 ? "s" : ""} ·{" "}
            <b className="text-foreground tabular">{nf.format(couverture.perimetresGeolocalises)}</b> périmètres
          </div>
        </div>
      </Kpi>

      <Kpi
        icon={FileCheck2}
        label="Actes délivrés"
        href="/dashboard/documents"
        loading={loading}
        value={actes.delivrees}
        legende={
          <>
            sur {nf.format(actes.attestations)} attestation{actes.attestations > 1 ? "s" : ""} de cession émise
            {actes.attestations > 1 ? "s" : ""}
          </>
        }
      >
        <Sparkline
          data={actes.serie}
          color="var(--chart-3)"
          ariaLabel={`Attestations émises par jour sur 30 jours : ${actes.serie.join(", ")}`}
        />
      </Kpi>

      <Kpi
        icon={Banknote}
        label="Recettes encaissées"
        href="/dashboard/paiements"
        loading={loading}
        value={recettes.encaisse}
        format={(n) => `${fcfa(n)} F`}
        legende={
          recettes.encaisse === 0 ? (
            <>Aucun encaissement — le paiement en ligne n&apos;est pas encore activé</>
          ) : (
            <>
              dont {fcfa(recettes.commissions)} F de commission ·{" "}
              {recettes.enAttente > 0 ? `${nf.format(recettes.enAttente)} en attente` : "aucun en attente"}
            </>
          )
        }
      >
        {recettes.encaisse === 0 ? (
          <div className="flex h-10 items-center rounded-md border border-dashed border-border px-3 text-[11.5px] text-muted-foreground">
            En attente de l&apos;activation CinetPay
          </div>
        ) : (
          <Sparkline
            data={recettes.paiements.map((p) => p.montant_total ?? 0).reverse()}
            color="var(--chart-2)"
            ariaLabel="Évolution des encaissements"
          />
        )}
      </Kpi>
    </motion.section>
  );
}
