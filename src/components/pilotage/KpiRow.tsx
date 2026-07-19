"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Banknote, FileCheck2, Layers3, Satellite, Scale, Users } from "lucide-react";

import { stagger } from "@/lib/motion";
import type { AdminOverview } from "@/hooks/useAdminOverview";
import { Kpi, type KpiDelta } from "@/components/ds/kpi";
import { CompositionBar, Sparkline } from "@/components/ds/spark";

const nf = new Intl.NumberFormat("fr-FR");
const fcfa = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace(".", ",")} M` : nf.format(Math.round(n));

/**
 * Variation exacte d'un stock sur 30 jours, dérivée de sa série d'entrées.
 *
 * `serie` = créations par jour sur les 30 derniers jours, `stock` = total
 * aujourd'hui. Le stock d'il y a 30 jours vaut donc `stock - somme(serie)`, ce
 * qui donne un écart *mesuré*, pas estimé. Renvoie `undefined` quand l'écart
 * n'est pas interprétable (série vide, ou stock antérieur nul → pas de %).
 */
function delta30j(serie: number[], stock: number): { delta?: KpiDelta; anterieur: number | null } {
  const entrees = serie.reduce((s, n) => s + n, 0);
  const anterieur = stock - entrees;
  if (serie.length === 0 || entrees === 0 || anterieur <= 0) return { anterieur: null };
  return {
    delta: { pct: (entrees / anterieur) * 100, libelle: "vs il y a 30 jours" },
    anterieur,
  };
}

/**
 * Rangée d'indicateurs nationaux — six tuiles, alignées sur le handoff du 18/07.
 *
 * Chaque tuile ne porte une pastille de variation que si la variation décrit
 * *la même quantité* que son grand chiffre. « Actes délivrés » n'en a pas : la
 * série disponible compte les actes émis, pas les actes remis — une pastille y
 * décrirait autre chose que le nombre affiché.
 */
export function KpiRow({
  patrimoine,
  couverture,
  actes,
  recettes,
  files,
  loading,
}: {
  patrimoine: AdminOverview["patrimoine"];
  couverture: AdminOverview["couverture"];
  actes: AdminOverview["actes"];
  recettes: AdminOverview["recettes"];
  files: AdminOverview["files"];
  loading: boolean;
}) {
  const tauxCouverture = couverture.taux;
  const sansCoords = patrimoine.lots - couverture.lotsGeolocalises;
  const parcelles = delta30j(patrimoine.serie, patrimoine.lots);

  // Le handoff fait défiler cette rangée horizontalement — il y suppose une
  // sidebar repliable. La nôtre est fixe (250px) : le défilement masquerait
  // « Recettes » sans le moindre indice. Grille responsive à la place, pour
  // qu'aucun indicateur national ne reste hors champ.
  return (
    <motion.section
      variants={stagger(0, 0.05)}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6"
      aria-label="Indicateurs clés"
    >
      <Kpi
        icon={Layers3}
        label="Parcelles enregistrées"
        href="/dashboard/lots"
        loading={loading}
        value={patrimoine.lots}
        delta={parcelles.delta}
        legende={
          parcelles.anterieur !== null ? (
            <>vs {nf.format(parcelles.anterieur)} il y a 30 jours</>
          ) : (
            <>
              {nf.format(patrimoine.ilots)} îlots · {nf.format(patrimoine.lotissements)} périmètres
            </>
          )
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
        icon={Users}
        label="Attributaires"
        href="/dashboard/attributaires"
        loading={loading}
        value={patrimoine.attributaires}
        legende={<>personnes titulaires d&apos;au moins une attribution</>}
      />

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
            <>{nf.format(sansCoords)} lots sans coordonnées — le registre existe, sa carte non</>
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
        icon={Scale}
        label="Litiges ouverts"
        href="/dashboard/litiges"
        loading={loading}
        value={files.litigesOuverts}
        tone={files.litigesOuverts > 0 ? "warning" : "neutral"}
        legende={
          files.litigesOuverts === 0 ? (
            <>Aucun litige en cours</>
          ) : (
            <>
              sur {nf.format(files.litiges.length)} litige{files.litiges.length > 1 ? "s" : ""} enregistré
              {files.litiges.length > 1 ? "s" : ""}
            </>
          )
        }
      />

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
