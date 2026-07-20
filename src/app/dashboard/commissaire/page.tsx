"use client";

import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  FileCheck2,
  FileWarning,
  Gift,
  Landmark,
  Lock,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { stagger } from "@/lib/motion";
import { createClient } from "@/utils/supabase/client";
import { useChargement } from "@/hooks/useChargement";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { AppShell } from "@/components/pilotage/AppShell";
import { Badge } from "@/components/ds/badge";
import { Card } from "@/components/ds/card";
import { EmptyState } from "@/components/ds/empty-state";
import { Kpi } from "@/components/ds/kpi";
import { ScrollArea } from "@/components/ds/scroll-area";
import {
  LotDetailModal,
  QUALITE_LABELS,
  type LotRecord,
  type LitigeRow,
  type ScoreConfiance,
} from "@/components/dashboard/lots/LotDetailModal";

// ─── Espace Commissaire ───────────────────────────────────────────────────────
// Supervision EN LECTURE SEULE. Le commissaire de justice ne voit QUE les
// lotissements dont il a légalisé les PV (scope porté par la RPC
// `registre_supervision`, via lotissements.pv_commissaire_justice_id). Le
// vérificateur et l'admin gardent une vue nationale.
//
// Le registre est servi par une RPC SECURITY DEFINER : la variante PostgREST
// imbriquée dépassait le statement_timeout sur ~900 lots (HTTP 500 silencieux →
// « 0 lot » permanent). La RPC renvoie des lignes déjà mises à plat.

type SupRow = {
  lot_id: string;
  numero_lot: string | null;
  ilot_numero: string | null;
  lotissement_nom: string | null;
  statut: string | null;
  verrouille: boolean | null;
  attributaire_nom: string | null;
  qualite: string | null;
  attestation_reference: string | null;
  attestation_statut: string | null;
  attestation_delivree: boolean | null;
  attestation_gratuite: boolean | null;
  pv_alerte_statut: string | null;
};

const STATUT_LOT: Record<string, { tone: "accent" | "success" | "neutral" | "danger" | "warning"; label: string }> = {
  attribue: { tone: "accent", label: "Attribué" },
  occupe: { tone: "accent", label: "Occupé" },
  vendu: { tone: "success", label: "Vendu" },
  libre: { tone: "neutral", label: "Libre" },
  en_litige: { tone: "danger", label: "Litige" },
  reserve_equipement: { tone: "warning", label: "Réservé" },
};

const FILTERS = [
  { key: "all", label: "Tous" },
  { key: "attribue", label: "Attribués" },
  { key: "vendu", label: "Vendus" },
  { key: "libre", label: "Libres" },
  { key: "pv", label: "PV à régulariser" },
] as const;

export default function CommissairePage() {
  const supabase = useMemo(() => createClient(), []);

  const [groupe, setGroupe] = useState<string | null>(null);
  const [rows, setRows] = useState<SupRow[]>([]);
  const [litigesCount, setLitigesCount] = useState(0);
  const [filter, setFilter] = useState<string>("all");

  // Dossier foncier d'un lot (lecture seule), chargé à la demande puis affiché
  // dans le modal partagé — même pattern que ProprietaireTerrienView.
  const [dossierLot, setDossierLot] = useState<LotRecord | null>(null);
  const [dossierLitiges, setDossierLitiges] = useState<LitigeRow[]>([]);
  const [dossierScore, setDossierScore] = useState<ScoreConfiance | null>(null);
  const [dossierEnCours, setDossierEnCours] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const [rpcRes, litigesRes, profRes] = await Promise.all([
      // Registre déjà scopé + mis à plat (voir migration registre_supervision).
      supabase.rpc("registre_supervision"),
      // Litiges actifs — RLS déjà scopée au ressort du commissaire.
      supabase.from("litiges").select("id", { count: "exact", head: true }).neq("statut", "clos"),
      user
        ? supabase.from("profiles").select("groupe").eq("id", user.id).single()
        : Promise.resolve({ data: null }),
    ]);
    setRows((rpcRes.data ?? []) as SupRow[]);
    setLitigesCount(litigesRes.count ?? 0);
    setGroupe((profRes.data as { groupe: string } | null)?.groupe ?? null);
  }, [supabase]);

  const { isLoading: loading, recharger } = useChargement(fetchData, [fetchData]);
  const { counts } = useBadgeCounts();

  // Charge le dossier complet d'un lot à la demande, puis ouvre le modal partagé.
  const ouvrirDossier = async (lotId: string) => {
    setDossierEnCours(lotId);
    const [{ data: lotData }, { data: litigesData }, { data: scoreData }] = await Promise.all([
      supabase
        .from("lots")
        .select(
          "id, numero_lot, numero_parcelle, ilot_id, statut, verrouille, superficie_m2, est_equipement, nature_droit, observation, guide_page, ilots(id, numero, lotissements(nom, commune, village, autorite_coutumiere_id)), attributions(rang, qualite, actuel, depuis, observation, attributaires(id, nom, type)), attestations_cession(reference, statut, cession_id)"
        )
        .eq("id", lotId)
        .single(),
      supabase.from("litiges").select("id, objet, statut, ouvert_le").eq("lot_id", lotId),
      supabase.rpc("calculer_score_confiance", { p_lot_id: lotId }),
    ]);
    setDossierLitiges((litigesData ?? []) as LitigeRow[]);
    setDossierScore((scoreData ?? null) as ScoreConfiance | null);
    setDossierLot((lotData ?? null) as unknown as LotRecord | null);
    setDossierEnCours(null);
  };

  const estCommissaire = groupe === "commissaire";

  const attDelivrees = rows.filter((r) => r.attestation_delivree).length;
  const attGratuites = rows.filter((r) => r.attestation_gratuite).length;
  const attestationsAvecRef = rows.filter((r) => r.attestation_reference).length;
  const pvAlertLots = rows.filter((r) => r.pv_alerte_statut);
  const lotissementsUniques = new Set(
    rows.map((r) => r.lotissement_nom).filter((n): n is string => !!n)
  ).size;

  const shown = rows.filter((r) => {
    if (filter === "pv") return !!r.pv_alerte_statut;
    if (filter !== "all" && r.statut !== filter) return false;
    return true;
  });

  // Le chargement et l'état vide gardent la coquille : sans elle, l'écran
  // perdrait sa navigation le temps de la requête, puis la retrouverait.
  if (loading) {
    return (
      <AppShell loading counts={counts} onRefresh={recharger}>
        <div className="flex min-h-[320px] items-center justify-center">
          <span className="text-[13px] font-medium text-muted-2">Chargement du registre…</span>
        </div>
      </AppShell>
    );
  }

  // ── État vide : commissaire non encore rattaché à un lotissement légalisé ──
  if (rows.length === 0 && estCommissaire) {
    return (
      <AppShell loading={false} counts={counts} onRefresh={recharger}>
        <EmptyState
          icon={ShieldCheck}
          title="Aucun lotissement sous votre supervision"
          description="Votre supervision porte sur les lotissements dont vous avez légalisé les PV. Dès qu'un lotissement vous est rattaché, son registre apparaîtra ici."
          action={{ label: "Contacter l'administration", href: "/dashboard/messages" }}
        />
      </AppShell>
    );
  }

  return (
    <AppShell loading={loading} counts={counts} onRefresh={recharger}>
      {/* En-tête */}
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11px] font-bold tracking-[0.22em] text-primary uppercase">
            {estCommissaire ? "Commissaire de justice · Supervision" : "Supervision · Contrôle et conformité"}
          </p>
          <Badge tone="neutral">
            <ShieldCheck className="size-3" />
            Lecture seule
          </Badge>
        </div>
        <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">
          {estCommissaire ? "Registre sous ma supervision" : "Registre foncier national"}
        </h1>
        <p className="text-[13.5px] text-muted-foreground">
          {rows.length} lot{rows.length > 1 ? "s" : ""} · {lotissementsUniques} lotissement
          {lotissementsUniques > 1 ? "s" : ""}
          {estCommissaire ? " dont vous avez légalisé les PV." : " — accès en consultation."}
        </p>
        <p className="mt-1 max-w-2xl text-[13px] text-muted-2">
          Consultez le registre, filtrez par statut, et ouvrez le dossier foncier de chaque lot — score de
          confiance, historique de propriété, litiges.
        </p>
      </div>

      <motion.section
        variants={stagger(0, 0.05)}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
        aria-label="Indicateurs de supervision"
      >
        <Kpi
          icon={Landmark}
          label="Lots sous supervision"
          href="#registre"
          loading={loading}
          value={rows.length}
          legende={
            <>
              sur {lotissementsUniques} lotissement{lotissementsUniques > 1 ? "s" : ""}
            </>
          }
        />
        <Kpi
          icon={FileCheck2}
          label="Attestations délivrées"
          href="#registre"
          loading={loading}
          value={attDelivrees}
          legende={<>sur {attestationsAvecRef} au registre</>}
        />
        <Kpi
          icon={Gift}
          label="Dont gratuites"
          href="#registre"
          loading={loading}
          value={attGratuites}
          legende={<>1ers propriétaires d&apos;origine</>}
        />
        <Kpi
          icon={AlertTriangle}
          label="PV à régulariser"
          href="#registre"
          loading={loading}
          value={pvAlertLots.length}
          tone={pvAlertLots.length > 0 ? "warning" : "neutral"}
          legende={pvAlertLots.length > 0 ? <>lots en attente de PV</> : <>aucun PV en attente</>}
        />
        <Kpi
          icon={FileWarning}
          label="Litiges"
          href="/dashboard/litiges"
          loading={loading}
          value={litigesCount}
          tone={litigesCount > 0 ? "warning" : "neutral"}
          legende={litigesCount > 0 ? <>actifs sur votre ressort</> : <>aucun litige actif</>}
        />
      </motion.section>

      {/* Registre des lots — cible de l'ancre #registre */}
      <Card id="registre" className="scroll-mt-6 overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="flex items-center gap-1.5 text-[13.5px] font-semibold text-foreground">
            <ScrollText className="size-4 text-primary" />
            Registre des lots
          </h2>
          <p className="mt-0.5 text-[11.5px] text-muted-2">
            {pvAlertLots.length > 0
              ? `${pvAlertLots.length} lot${pvAlertLots.length > 1 ? "s" : ""} avec PV en attente — cliquez un lot pour ouvrir son dossier foncier`
              : "Cliquez un lot pour ouvrir son dossier foncier"}
          </p>
        </div>

        <div className="scb flex gap-2 overflow-x-auto border-b border-border px-5 py-3">
          {FILTERS.map((f) => {
            const n =
              f.key === "all"
                ? rows.length
                : f.key === "pv"
                  ? pvAlertLots.length
                  : rows.filter((r) => r.statut === f.key).length;
            const actif = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={actif}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  actif
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground",
                )}
              >
                {f.label}
                <span
                  className={cn(
                    "tabular rounded-full px-1.5 text-[10px]",
                    actif ? "bg-white/20" : "bg-inset text-muted-2",
                  )}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>

        {/* Le registre d'un commissaire dépasse le millier de lots : la liste
            défile chez elle plutôt que d'étirer la page sans fin. */}
        <ScrollArea className="max-h-[560px]">
          <div className="divide-y divide-border">
            {shown.length === 0 ? (
              <div className="px-5 py-10 text-center text-[13px] text-muted-2">Aucun lot dans ce filtre.</div>
            ) : (
              shown.map((r) => {
                const st = STATUT_LOT[r.statut ?? "libre"] ?? STATUT_LOT.libre;
                return (
                  <button
                    key={r.lot_id}
                    type="button"
                    onClick={() => ouvrirDossier(r.lot_id)}
                    disabled={dossierEnCours === r.lot_id}
                    className={cn(
                      "flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-inset",
                      dossierEnCours === r.lot_id && "opacity-60",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="tabular text-[11.5px] text-muted-2">
                          Îlot {r.ilot_numero} · Lot {r.numero_lot}
                        </span>
                        <span className="text-[13.5px] font-semibold text-foreground">
                          {r.attributaire_nom ?? "— libre"}
                        </span>
                        {r.verrouille && <Lock className="size-3 text-warning" />}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-muted-foreground">
                        {r.qualite && <span>{QUALITE_LABELS[r.qualite] ?? r.qualite}</span>}
                        {r.attestation_statut && (
                          <span className="text-success">· attestation {r.attestation_statut}</span>
                        )}
                        {r.pv_alerte_statut && (
                          <span className="text-warning">· PV {r.pv_alerte_statut.replace(/_/g, " ")}</span>
                        )}
                      </div>
                    </div>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </Card>

      {/* Dossier foncier (lecture seule) — modal partagé */}
      {dossierLot && (
        <LotDetailModal
          lot={dossierLot}
          litiges={dossierLitiges}
          score={dossierScore}
          pvAlert={null}
          onClose={() => setDossierLot(null)}
        />
      )}
    </AppShell>
  );
}
