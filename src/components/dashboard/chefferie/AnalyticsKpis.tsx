"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Banknote, FileCheck2, Map } from "lucide-react";

import { stagger } from "@/lib/motion";
import { Kpi } from "@/components/ds/kpi";
import { CompositionBar, Sparkline } from "@/components/ds/spark";

const nf = new Intl.NumberFormat("fr-FR");
const fcfa = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(".", ",")} M` : nf.format(Math.round(n));

/**
 * Section analytique du dashboard chefferie — remplace les 4 compteurs
 * statiques par de vrais indicateurs territoriaux (composition, tendance),
 * même vocabulaire visuel que le Centre de pilotage admin (`Kpi`/`ds/spark`).
 */
export function AnalyticsKpis({
  loading,
  territoire,
  actes,
  recettes,
  alertes,
}: {
  loading: boolean;
  territoire: { lots: number; occupes: number; libres: number; enLitige: number; lotissements: number };
  actes: { total: number; delivrees: number; serie: number[] };
  recettes: { total: number; serie: number[] };
  alertes: { attestationsAValider: number; litiges: number; apfcEnAttente: number };
}) {
  const alertesTotal = alertes.attestationsAValider + alertes.litiges + alertes.apfcEnAttente;

  return (
    <motion.section
      variants={stagger(0, 0.05)}
      initial="hidden"
      animate="show"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      aria-label="Indicateurs du territoire"
    >
      <Kpi
        icon={Map}
        label="Territoire"
        loading={loading}
        value={territoire.lots}
        legende={
          <>
            {nf.format(territoire.lotissements)} lotissement{territoire.lotissements > 1 ? "s" : ""}
          </>
        }
      >
        <div>
          <CompositionBar
            segments={[
              { key: "occ", label: "Occupés", value: territoire.occupes, color: "var(--chart-1)" },
              { key: "lib", label: "Libres", value: territoire.libres, color: "var(--chart-3)" },
              { key: "lit", label: "En litige", value: territoire.enLitige, color: "var(--danger)" },
            ]}
          />
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>
              <b className="text-foreground tabular">{nf.format(territoire.occupes)}</b> occupés
            </span>
            <span>
              <b className="text-success tabular">{nf.format(territoire.libres)}</b> libres
            </span>
          </div>
        </div>
      </Kpi>

      <Kpi
        icon={FileCheck2}
        label="Actes délivrés"
        loading={loading}
        value={actes.delivrees}
        legende={
          <>
            sur {nf.format(actes.total)} attestation{actes.total > 1 ? "s" : ""} de cession émise
            {actes.total > 1 ? "s" : ""}
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
        label="Recettes perçues"
        loading={loading}
        value={recettes.total}
        format={(n) => `${fcfa(n)} F`}
        legende={
          recettes.total === 0 ? (
            <>Aucune recette perçue sur ce territoire pour l&apos;instant</>
          ) : (
            <>Part de la chefferie sur les attestations de cession délivrées</>
          )
        }
      >
        {recettes.total === 0 ? (
          <div className="flex h-10 items-center rounded-md border border-dashed border-border px-3 text-[11.5px] text-muted-foreground">
            Aucun paiement confirmé pour l&apos;instant
          </div>
        ) : (
          <Sparkline data={recettes.serie} color="var(--chart-2)" ariaLabel="Évolution des recettes perçues" />
        )}
      </Kpi>

      <Kpi
        icon={AlertTriangle}
        label="Alertes"
        loading={loading}
        value={alertesTotal}
        tone={alertesTotal > 0 ? "warning" : "neutral"}
        legende={
          alertesTotal === 0 ? (
            <>Aucune alerte en cours</>
          ) : (
            <>
              {nf.format(alertes.attestationsAValider)} à signer · {nf.format(alertes.litiges)} litige
              {alertes.litiges > 1 ? "s" : ""} · {nf.format(alertes.apfcEnAttente)} APFC en attente
            </>
          )
        }
      >
        <div>
          <CompositionBar
            segments={[
              { key: "att", label: "Attestations à signer", value: alertes.attestationsAValider, color: "var(--chart-1)" },
              { key: "lit", label: "Litiges", value: alertes.litiges, color: "var(--danger)" },
              { key: "apfc", label: "APFC en attente", value: alertes.apfcEnAttente, color: "var(--warning)" },
            ]}
          />
        </div>
      </Kpi>
    </motion.section>
  );
}
