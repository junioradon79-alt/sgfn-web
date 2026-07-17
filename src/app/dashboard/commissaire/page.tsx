"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronRight,
  FileCheck2,
  FileWarning,
  Gift,
  Landmark,
  Lock,
  ScrollText,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/utils/supabase/client";
import { useChargement } from "@/hooks/useChargement";
import { LoadingScreen, StatCard } from "@/components/dashboard/chefferie/SharedUI";
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

const STATUT_LOT: Record<string, { badge: "disponible" | "attribue" | "en_validation" | "litige"; label: string }> = {
  attribue: { badge: "attribue", label: "Attribué" },
  occupe: { badge: "attribue", label: "Occupé" },
  vendu: { badge: "attribue", label: "Vendu" },
  libre: { badge: "disponible", label: "Libre" },
  en_litige: { badge: "litige", label: "Litige" },
  reserve_equipement: { badge: "en_validation", label: "Réservé" },
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

  const { isLoading: loading } = useChargement(fetchData, [fetchData]);

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

  if (loading) return <LoadingScreen />;

  // ── État vide : commissaire non encore rattaché à un lotissement légalisé ──
  if (rows.length === 0 && estCommissaire) {
    return (
      <div className="flex min-h-[320px] items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
            <ShieldCheck className="h-6 w-6 text-[#1E6091]" />
          </div>
          <p className="text-sm font-semibold text-slate-800">Aucun lotissement sous votre supervision</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Votre supervision porte sur les lotissements dont vous avez légalisé les PV. Dès qu&apos;un
            lotissement vous est rattaché, son registre apparaîtra ici.
          </p>
          <Link
            href="/dashboard/messages"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#0D3B66] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1E6091]"
          >
            Contacter l&apos;administration
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#1E6091]">
            {estCommissaire ? "Commissaire de justice · Supervision" : "Supervision · Contrôle et conformité"}
          </p>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <ShieldCheck className="h-3 w-3" />
            Lecture seule
          </span>
        </div>
        <h1 className="text-2xl font-bold text-[#0D3B66]">
          {estCommissaire ? "Registre sous ma supervision" : "Registre foncier national"}
        </h1>
        <p className="text-sm text-slate-500">
          {rows.length} lot{rows.length > 1 ? "s" : ""} · {lotissementsUniques} lotissement
          {lotissementsUniques > 1 ? "s" : ""}
          {estCommissaire ? " dont vous avez légalisé les PV." : " — accès en consultation."}
        </p>
      </div>

      {/* Carte principale — registre des lots (ancre sur la même page) */}
      <a
        href="#registre"
        className="group flex items-center justify-between gap-4 rounded-3xl border border-[#0D3B66]/15 bg-gradient-to-br from-[#0D3B66] to-[#1E6091] p-6 text-white shadow-sm transition hover:shadow-md sm:p-8"
      >
        <div>
          <div className="flex items-center gap-2 text-white/70">
            <Landmark className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em]">Lots sous supervision</span>
          </div>
          <p className="mt-3 text-5xl font-bold leading-none">{rows.length}</p>
          <p className="mt-2 max-w-md text-sm text-white/70">
            Consultez le registre, filtrez par statut, et ouvrez le dossier foncier de chaque lot
            (score de confiance, historique de propriété, litiges).
          </p>
        </div>
        <ChevronRight className="h-6 w-6 shrink-0 text-white/60 transition group-hover:translate-x-1" />
      </a>

      {/* Rubriques de synthèse */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          href="#registre"
          icon={FileCheck2}
          label="Attestations délivrées"
          value={attDelivrees}
          subtitle={`sur ${attestationsAvecRef} au registre`}
        />
        <StatCard
          href="#registre"
          icon={Gift}
          label="Dont gratuites"
          value={attGratuites}
          subtitle="1ers propriétaires d'origine"
        />
        <StatCard
          href="#registre"
          icon={AlertTriangle}
          label="PV à régulariser"
          value={pvAlertLots.length}
          subtitle={pvAlertLots.length > 0 ? "Lots en attente de PV" : "À jour"}
          alerte={pvAlertLots.length}
        />
        <StatCard
          href="/dashboard/litiges"
          icon={FileWarning}
          label="Litiges"
          value={litigesCount}
          subtitle={litigesCount > 0 ? "Actifs sur votre ressort" : "Aucun litige actif"}
          alerte={litigesCount}
        />
      </div>

      {/* Registre des lots — cible de l'ancre #registre */}
      <section
        id="registre"
        className="scroll-mt-6 overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm"
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-[#0D3B66]">
            <ScrollText className="h-4 w-4 text-[#0D3B66]" />
            Registre des lots
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {pvAlertLots.length > 0
              ? `${pvAlertLots.length} lot${pvAlertLots.length > 1 ? "s" : ""} avec PV en attente`
              : "Cliquez un lot pour ouvrir son dossier foncier"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-3">
          {FILTERS.map((f) => {
            const n =
              f.key === "all"
                ? rows.length
                : f.key === "pv"
                  ? pvAlertLots.length
                  : rows.filter((r) => r.statut === f.key).length;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === f.key
                    ? "border-[#0D3B66] bg-[#0D3B66] text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {f.label}
                <span
                  className={`rounded-full px-1.5 text-[10px] ${
                    filter === f.key ? "bg-white/20" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {n}
                </span>
              </button>
            );
          })}
        </div>

        <div className="divide-y divide-slate-100">
          {shown.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-slate-500">Aucun lot dans ce filtre.</div>
          ) : (
            shown.map((r) => {
              const st = STATUT_LOT[r.statut ?? "libre"] ?? STATUT_LOT.libre;
              return (
                <button
                  key={r.lot_id}
                  type="button"
                  onClick={() => ouvrirDossier(r.lot_id)}
                  disabled={dossierEnCours === r.lot_id}
                  className={`flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-slate-50 ${
                    dossierEnCours === r.lot_id ? "opacity-60" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-slate-400">
                        Îlot {r.ilot_numero} · Lot {r.numero_lot}
                      </span>
                      <span className="text-sm font-semibold text-slate-800">
                        {r.attributaire_nom ?? "— libre"}
                      </span>
                      {r.verrouille && <Lock className="h-3 w-3 text-amber-500" />}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                      {r.qualite && <span>{QUALITE_LABELS[r.qualite] ?? r.qualite}</span>}
                      {r.attestation_statut && <span className="text-[#2D8F5A]">· attestation {r.attestation_statut}</span>}
                      {r.pv_alerte_statut && (
                        <span className="text-[#F39C12]">· PV {r.pv_alerte_statut.replace(/_/g, " ")}</span>
                      )}
                    </div>
                  </div>
                  <Badge status={st.badge}>{st.label}</Badge>
                </button>
              );
            })
          )}
        </div>
      </section>

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
    </div>
  );
}
