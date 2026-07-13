"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Layers, Map as MapIcon, Maximize2, Minimize2, Satellite, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import { fadeUp } from "@/lib/motion";
import type { AdminOverview, Perimetre } from "@/hooks/useAdminOverview";
import { Button } from "@/components/ds/button";
import { Card, CardAction, CardHeader, CardTitle, CardDescription } from "@/components/ds/card";
import { CompositionBar } from "@/components/ds/spark";
import { Skeleton } from "@/components/ds/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ds/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ds/tooltip";
import type { FondCarte } from "./TerritoryCanvas";

const TerritoryCanvas = dynamic(() => import("./TerritoryCanvas"), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" />,
});

const nf = new Intl.NumberFormat("fr-FR");

/**
 * Carte du territoire — le composant principal du Centre de pilotage.
 *
 * Il occupe la plus grande surface de l'écran parce que c'est la seule vue qui
 * répond à « où ? », et que le foncier est d'abord une question de lieu.
 *
 * Choix éditorial : la carte affiche l'état réel de la couverture, y compris
 * son insuffisance. Un lot sur 898 est géolocalisé — c'est le chiffre qui doit
 * sauter aux yeux d'un pilote national, pas un dégradé de districts.
 */
export function TerritoryMap({
  couverture,
  totalLots,
  loading,
}: {
  couverture: AdminOverview["couverture"];
  totalLots: number;
  loading: boolean;
}) {
  const [fond, setFond] = React.useState<FondCarte>("plan");
  const [afficherLots, setAfficherLots] = React.useState(true);
  const [plein, setPlein] = React.useState(false);
  const [selectionId, setSelectionId] = React.useState<string | null>(null);

  const { perimetres, lotsGeo, lotsGeolocalises, taux } = couverture;

  // Échap referme le plein écran.
  React.useEffect(() => {
    if (!plein) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPlein(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [plein]);

  const sansCoords = totalLots - lotsGeolocalises;

  // La sélection est *dérivée*, pas synchronisée : à défaut de choix explicite,
  // c'est le plus gros périmètre. Aucun effet à écrire, donc aucun rendu
  // intermédiaire où la carte serait vide en attendant sa sélection par défaut.
  const courant = React.useMemo(
    () => perimetres.find((p) => p.id === selectionId) ?? perimetres[0] ?? null,
    [perimetres, selectionId],
  );

  const setSelection = React.useCallback((p: Perimetre) => setSelectionId(p.id), []);

  return (
    <motion.div variants={fadeUp} className={cn(plein && "fixed inset-0 z-50 bg-background p-4")}>
      <Card className={cn("overflow-hidden", plein && "h-full")}>
        <CardHeader className="border-b border-border">
          <div className="min-w-0">
            <CardTitle>Territoire cartographié</CardTitle>
            <CardDescription>
              {loading ? (
                "Chargement du périmètre…"
              ) : perimetres.length === 0 ? (
                "Aucun périmètre enregistré."
              ) : (
                <>
                  {nf.format(perimetres.length)} périmètre{perimetres.length > 1 ? "s" : ""} ·{" "}
                  {nf.format(perimetres.reduce((s, p) => s + p.lots, 0))} lots rattachés
                </>
              )}
            </CardDescription>
          </div>

          <CardAction>
            <Tabs value={fond} onValueChange={(v) => setFond(v as FondCarte)}>
              <TabsList>
                <TabsTrigger value="plan">
                  <MapIcon />
                  <span className="hidden sm:inline">Plan</span>
                </TabsTrigger>
                <TabsTrigger value="satellite">
                  <Satellite />
                  <span className="hidden sm:inline">Satellite</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={afficherLots ? "subtle" : "ghost"}
                  size="icon-sm"
                  onClick={() => setAfficherLots((v) => !v)}
                  aria-pressed={afficherLots}
                  aria-label="Afficher les lots géolocalisés"
                >
                  <Layers />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {afficherLots ? "Masquer" : "Afficher"} les lots géolocalisés ({nf.format(lotsGeo.length)})
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setPlein((v) => !v)}
                  aria-label={plein ? "Quitter le plein écran" : "Afficher en plein écran"}
                >
                  {plein ? <Minimize2 /> : <Maximize2 />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{plein ? "Quitter le plein écran (Échap)" : "Plein écran"}</TooltipContent>
            </Tooltip>
          </CardAction>
        </CardHeader>

        <div className={cn("grid min-h-0 flex-1 xl:grid-cols-[1.9fr_1fr]", !plein && "h-[26rem] sm:h-[30rem]")}>
          {/* Carte */}
          <div className="relative min-h-[16rem] border-b border-border xl:border-r xl:border-b-0">
            {loading ? (
              <Skeleton className="size-full rounded-none" />
            ) : (
              <TerritoryCanvas
                perimetres={perimetres}
                lotsGeo={lotsGeo}
                selection={courant}
                onSelect={setSelection}
                fond={fond}
                afficherLots={afficherLots}
              />
            )}
          </div>

          {/* Volet de contexte */}
          <div className="flex min-h-0 flex-col overflow-y-auto">
            {/* Couverture réelle — affichée, pas masquée. */}
            {!loading && sansCoords > 0 && (
              <div className="flex items-start gap-2.5 border-b border-border bg-warning-subtle px-5 py-3.5">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                <div className="min-w-0">
                  <p className="text-[12.5px] font-semibold text-foreground">
                    Couverture GPS : {taux < 1 ? taux.toFixed(1) : Math.round(taux)} %
                  </p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                    {`${nf.format(sansCoords)} lot${sansCoords > 1 ? "s" : ""} sur ${nf.format(totalLots)} ${sansCoords > 1 ? "n'ont" : "n'a"} aucune coordonnée.`}{" "}
                    Le registre est complet, sa projection au sol ne l&apos;est pas.
                  </p>
                  <Link
                    href="/dashboard/carte"
                    className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-accent hover:underline"
                  >
                    Ouvrir la carte foncière
                    <ArrowUpRight className="size-3" aria-hidden />
                  </Link>
                </div>
              </div>
            )}

            <div className="p-5">
              <p className="text-[10.5px] font-bold tracking-wider text-muted-foreground uppercase">Périmètres</p>

              {loading ? (
                <div className="mt-3 space-y-3">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : (
                <ul className="mt-2.5 space-y-1.5">
                  {perimetres.map((p) => {
                    const actif = courant?.id === p.id;
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => setSelection(p)}
                          aria-pressed={actif}
                          className={cn(
                            "w-full rounded-lg border p-3 text-left outline-none transition-colors",
                            "focus-visible:ring-2 focus-visible:ring-ring/50",
                            actif
                              ? "border-accent/40 bg-accent-subtle"
                              : "border-transparent hover:border-border hover:bg-inset",
                          )}
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-[13px] font-semibold text-foreground">{p.nom}</span>
                            <span className="shrink-0 text-[12px] font-bold text-foreground tabular">
                              {p.tauxOccupation}%
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                            {p.commune ?? "—"}
                            {p.village ? ` · ${p.village}` : ""} — {nf.format(p.lots)} lots
                          </p>
                          <CompositionBar
                            className="mt-2"
                            height={5}
                            segments={[
                              { key: "occ", label: "Occupés", value: p.occupes, color: "var(--chart-1)" },
                              { key: "lib", label: "Libres", value: p.libres, color: "var(--chart-3)" },
                              { key: "lit", label: "En litige", value: p.enLitige, color: "var(--danger)" },
                            ]}
                          />
                          {actif && (
                            <div className="mt-2.5 flex gap-4 text-[11.5px]">
                              <span className="text-muted-foreground">
                                Occupés <b className="text-foreground tabular">{nf.format(p.occupes)}</b>
                              </span>
                              <span className="text-muted-foreground">
                                Libres <b className="text-success tabular">{nf.format(p.libres)}</b>
                              </span>
                              {p.enLitige > 0 && (
                                <span className="text-muted-foreground">
                                  Litiges <b className="text-danger tabular">{nf.format(p.enLitige)}</b>
                                </span>
                              )}
                            </div>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
