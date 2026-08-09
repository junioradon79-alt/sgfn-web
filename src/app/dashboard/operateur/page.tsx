"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Boxes, HandCoins, Landmark, MapPin, MessageSquare, PackageCheck } from "lucide-react";

import { createClient } from "@/utils/supabase/client";
import { fetchAllPages, messageLecture, type ReponsePostgrest } from "@/lib/supabase-pagination";
import { fadeUp, stagger } from "@/lib/motion";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";

import { AppShell } from "@/components/pilotage/AppShell";
import { Badge } from "@/components/ds/badge";
import { Button } from "@/components/ds/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ds/card";
import { EmptyState } from "@/components/ds/empty-state";
import { Kpi } from "@/components/ds/kpi";
import { ScrollArea } from "@/components/ds/scroll-area";
import { Skeleton } from "@/components/ds/skeleton";

/**
 * Espace Opérateur — vue cantonnée à SON périmètre (RLS lots_read_scope).
 * L'opérateur est rémunéré en « lots en nature » (attribution qualite='operateur') ;
 * ce sont les seuls lots qu'il peut céder à des tiers. On les met en avant ici,
 * et ils sont marqués dans l'inventaire visiteur (espace Acquisition).
 */

type LotRow = {
  id: string;
  numero_lot: string | number | null;
  statut: string | null;
  ilots: {
    numero: string | number | null;
    lotissement_id: string | null;
    lotissements: { nom: string | null; operateur_id: string | null } | null;
  } | null;
  attributions: Array<{
    qualite: string | null;
    actuel: boolean | null;
    attributaires: { nom: string | null } | null;
  }> | null;
};

type LotissementRow = {
  id: string;
  nom: string | null;
  village: string | null;
  commune: string | null;
  nb_lots: number | null;
  nb_ilots: number | null;
};

const STATUT_LOT: Record<string, { tone: "accent" | "success" | "neutral" | "danger"; label: string }> = {
  attribue: { tone: "accent", label: "Détenu" },
  vendu: { tone: "success", label: "Cédé" },
  libre: { tone: "neutral", label: "Libre" },
  en_litige: { tone: "danger", label: "Litige" },
};

const estLotOperateur = (l: LotRow) =>
  (l.attributions ?? []).some((a) => a.qualite === "operateur");

export default function OperateurPage() {
  const supabase = useMemo(() => createClient(), []);

  const [lotissements, setLotissements] = useState<LotissementRow[]>([]);
  const [lots, setLots] = useState<LotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  /**
   * 🔴 `mon_operateur_id`, les lotissements et les deux lectures paginées
   * jetaient toutes leur `error`. Un opérateur dont la RPC de périmètre échoue
   * voyait « Aucun lotissement n'est rattaché à votre compte opérateur » —
   * l'écran lui déniait son parc au lieu de dire qu'il n'avait pas pu le lire.
   */
  const [chargeErreur, setChargeErreur] = useState<string | null>(null);

  const { counts } = useBadgeCounts();
  const rafraichir = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Périmètre opérateur : son identifiant + ses lotissements.
      const { data: monOp, error: monOpErr } = await supabase.rpc("mon_operateur_id");

      const lotissPromise = monOp
        ? supabase
            .from("lotissements")
            .select("id, nom, village, commune, nb_lots, nb_ilots")
            .eq("operateur_id", monOp)
            .order("nom")
        : Promise.resolve({ data: [], error: null });

      // Les lots sont déjà cantonnés à l'opérateur par le RLS (lots_read_scope).
      // L'embed imbriqué lots→attributions→attributaires timeoutait (8 s → HTTP
      // 500 → 0 lot) sur un gros périmètre (KONE MORIFERE = 849 lots) : PostgREST
      // le résout en LATERAL par lot avec RLS ré-évaluée ligne à ligne. On charge
      // donc les attributions À PLAT et on fusionne par lot_id, avec pagination
      // (> 1000 lignes possibles). Cf. audit dashboards 18/07.
      type LotBase = Omit<LotRow, "attributions">;
      type AttrRow = { lot_id: string | null } & NonNullable<LotRow["attributions"]>[number];
      const lotsPromise = fetchAllPages<LotBase>((from, to) =>
        supabase
          .from("lots")
          .select("id, numero_lot, statut, ilots(numero, lotissement_id, lotissements(nom, operateur_id))")
          .order("numero_lot", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to) as unknown as PromiseLike<ReponsePostgrest<LotBase>>
      );
      const attrsPromise = fetchAllPages<AttrRow>((from, to) =>
        supabase
          .from("attributions")
          .select("lot_id, qualite, actuel, attributaires(nom)")
          .order("id", { ascending: true })
          .range(from, to) as unknown as PromiseLike<ReponsePostgrest<AttrRow>>
      );

      const [lotiss, lotsData, attrsData] = await Promise.all([lotissPromise, lotsPromise, attrsPromise]);

      const attrsByLot = new Map<string, NonNullable<LotRow["attributions"]>>();
      for (const a of attrsData.rows) {
        if (!a.lot_id) continue;
        const { lot_id, ...rest } = a;
        const arr = attrsByLot.get(lot_id);
        if (arr) arr.push(rest);
        else attrsByLot.set(lot_id, [rest]);
      }

      setLotissements((lotiss.data ?? []) as unknown as LotissementRow[]);
      setLots(
        lotsData.rows.map((l) => ({ ...l, attributions: attrsByLot.get(l.id) ?? [] })) as unknown as LotRow[]
      );
      const echecs = (
        [
          ["votre rattachement opérateur", monOpErr],
          ["vos lotissements", lotiss.error],
          ["les lots de votre périmètre", lotsData.error],
          ["les attributions", attrsData.error],
        ] as const
      )
        .filter(([, e]) => !!e)
        .map(([quoi, e]) => messageLecture(quoi, e!));
      setChargeErreur(echecs.length ? echecs.join(" · ") : null);
      setLoading(false);
    })();
  }, [supabase, tick]);

  const opLots = lots.filter(estLotOperateur);
  const cedables = opLots.filter((l) => l.statut !== "vendu");
  const cedes = opLots.filter((l) => l.statut === "vendu");

  return (
    <AppShell loading={loading} counts={counts} onRefresh={rafraichir}>
      {/* Titre de l'écran — l'en-tête du shell porte la salutation, pas le
          contexte métier : c'est la page qui dit où l'on est et pourquoi. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">
            Espace Opérateur
          </h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            Vos lotissements et vos lots en nature — les seuls que vous pouvez céder à des tiers.
          </p>
        </div>
        <Button asChild variant="outline" className="shrink-0">
          <Link href="/dashboard/messages">
            <MessageSquare />
            Demandes d&apos;intérêt
          </Link>
        </Button>
      </div>

      {chargeErreur && (
        <p role="alert" className="rounded-xl border border-danger/25 bg-danger-subtle px-4 py-3 text-sm font-medium text-danger">
          {chargeErreur}
        </p>
      )}

      <motion.section
        variants={stagger(0, 0.05)}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Indicateurs de mon périmètre"
      >
        <Kpi
          icon={Landmark}
          label="Mes lotissements"
          loading={loading}
          value={lotissements.length}
          legende={<>périmètres dont vous êtes l&apos;opérateur</>}
        />
        <Kpi
          icon={Boxes}
          label="Lots dans mon périmètre"
          href="/dashboard/lots"
          loading={loading}
          value={lots.length}
          legende={<>tous statuts confondus</>}
        />
        <Kpi
          icon={HandCoins}
          label="Lots en nature (cédables)"
          loading={loading}
          value={cedables.length}
          tone={cedables.length > 0 ? "warning" : "neutral"}
          legende={<>reçus en rémunération, pas encore cédés</>}
        />
        <Kpi
          icon={PackageCheck}
          label="Lots en nature cédés"
          loading={loading}
          value={cedes.length}
          legende={<>sur {opLots.length} lot{opLots.length > 1 ? "s" : ""} en nature</>}
        />
      </motion.section>

      <motion.div variants={stagger(0.05, 0.06)} initial="hidden" animate="show" className="flex flex-col gap-5">
        <motion.div variants={fadeUp}>
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Mes lotissements</CardTitle>
                <CardDescription>Lotissements dont vous êtes l&apos;opérateur</CardDescription>
              </div>
            </CardHeader>

            <div className="px-5 pb-5">
              {loading ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Skeleton className="h-[104px]" />
                  <Skeleton className="h-[104px]" />
                </div>
              ) : lotissements.length === 0 ? (
                // Ne pas affirmer « aucun lotissement rattaché » quand c'est la
                // lecture du rattachement qui a échoué.
                chargeErreur ? null : (
                <EmptyState
                  icon={Landmark}
                  title="Aucun lotissement"
                  description="Aucun lotissement n'est rattaché à votre compte opérateur."
                />
                )
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {lotissements.map((lo) => (
                    <div
                      key={lo.id}
                      className="rounded-xl border border-border p-4 transition-colors hover:border-primary/40"
                    >
                      <p className="text-[13.5px] font-semibold text-foreground">{lo.nom}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted-2">
                        <MapPin className="size-3 shrink-0" aria-hidden />
                        {lo.village ?? "—"} · {lo.commune ?? "—"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-lg bg-inset px-3 py-1.5 text-[11.5px] text-muted-foreground">
                          <b className="tabular text-foreground">{lo.nb_lots ?? 0}</b> lots
                        </span>
                        <span className="rounded-lg bg-inset px-3 py-1.5 text-[11.5px] text-muted-foreground">
                          <b className="tabular text-foreground">{lo.nb_ilots ?? 0}</b> îlots
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <HandCoins className="size-4 text-warning" aria-hidden />
                  Mes lots en nature
                </CardTitle>
                <CardDescription>
                  Lots reçus en rémunération — les seuls que vous pouvez céder à des tiers
                  {!loading && opLots.length > 0 && ` · ${opLots.length} lot${opLots.length > 1 ? "s" : ""}`}
                </CardDescription>
              </div>
            </CardHeader>

            {loading ? (
              <div className="px-5 pb-5">
                <Skeleton className="h-32" />
              </div>
            ) : opLots.length === 0 ? (
              <div className="px-5 pb-5">
                <EmptyState
                  icon={HandCoins}
                  title="Aucun lot en nature"
                  description="Aucun lot n'est enregistré à votre nom en rémunération pour l'instant."
                />
              </div>
            ) : (
              // Un opérateur peut détenir plusieurs centaines de lots en nature
              // (612 sur le périmètre de test) : sans hauteur bornée, la page
              // s'étirait sur plus de 30 000 px et le reste de l'écran devenait
              // inatteignable. La liste défile chez elle.
              <ScrollArea className="max-h-[420px]">
                <ul className="divide-y divide-border">
                  {opLots.map((l) => {
                    const st = STATUT_LOT[l.statut ?? "libre"] ?? STATUT_LOT.libre;
                    return (
                      <li key={l.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                        <span className="tabular shrink-0 text-[11.5px] text-muted-2">
                          Îlot {l.ilots?.numero} · Lot {l.numero_lot}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">
                          {l.ilots?.lotissements?.nom ?? "—"}
                        </span>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </li>
                    );
                  })}
                </ul>
              </ScrollArea>
            )}

            <p className="border-t border-border px-5 py-3.5 text-[11.5px] leading-relaxed text-muted-2">
              Ces lots apparaissent dans l&apos;inventaire des visiteurs, signalés « Lot opérateur ». Quand un
              acquéreur manifeste son intérêt, vous recevez le message dans{" "}
              <b className="text-muted-foreground">Demandes d&apos;intérêt</b>.
            </p>
          </Card>
        </motion.div>
      </motion.div>
    </AppShell>
  );
}
