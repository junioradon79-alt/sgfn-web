"use client";

import { AlertTriangle, ExternalLink, Lock, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import RadialGauge from "@/components/ui/RadialGauge";

// ─── Types partagés (page Lots + détail lotissement) ───────────────────────────

export type LotStatus = "disponible" | "attribue" | "en_validation" | "litige";

export type LotRecord = {
  id: string;
  numero_lot?: string | number | null;
  numero_parcelle?: string | null;
  ilot_id?: string | null;
  statut?: string | null;
  verrouille?: boolean | null;
  superficie_m2?: number | null;
  est_equipement?: boolean | null;
  nature_droit?: string | null;
  observation?: string | null;
  guide_page?: number | null;
  ilots?: {
    id?: string | null;
    numero?: string | number | null;
    lotissements?: {
      nom?: string | null;
      commune?: string | null;
      village?: string | null;
      autorite_coutumiere_id?: string | null;
    } | null;
  } | null;
  attributions?: Array<{
    rang?: number | null;
    qualite?: string | null;
    actuel?: boolean | null;
    depuis?: string | null;
    observation?: string | null;
    attributaires?: { id?: string | null; nom?: string | null; type?: string | null } | null;
  }> | null;
  attestations_cession?: Array<{
    reference?: string | null;
    statut?: string | null;
    cession_id?: string | null;
  }> | null;
};

export type PvInfo = { reference: string | null; statut: string | null };

export type ScoreConfiance = {
  total: number;
  apfc: number;
  guide_repartition: number;
  pv_guide_repartition: number;
  pv_identification_physique: number;
};

export type LitigeRow = {
  id: string;
  objet: string | null;
  statut: string | null;
  ouvert_le: string | null;
};

// ─── Constantes partagées ──────────────────────────────────────────────────────

export const NATURE_DROIT_LABELS: Record<string, string> = {
  droit_coutumier: "Droit coutumier",
  attestation_villageoise: "Attestation villageoise",
  certificat_foncier: "Certificat foncier",
  acd: "ACD",
  titre_foncier: "Titre foncier",
};

export const QUALITE_LABELS: Record<string, string> = {
  ayant_droit: "Propriétaire d'origine",
  ayant_droit_transmission: "Ayant-droit par transmission",
  acquereur: "Acquéreur",
  operateur: "Opérateur",
  entrepreneur: "Entrepreneur",
  reservataire: "Réservataire",
};

export const STATUT_LITIGE_LABELS: Record<string, string> = {
  ouvert: "Ouvert", en_mediation: "En médiation", tranche: "Tranché", clos: "Clos",
};

const SCORE_LABELS: Record<keyof Omit<ScoreConfiance, "total">, string> = {
  apfc: "APFC",
  guide_repartition: "Guide de répartition",
  pv_guide_repartition: "PV du guide de répartition",
  pv_identification_physique: "PV d'identification physique",
};

const SCORE_MAX: Record<keyof Omit<ScoreConfiance, "total">, number> = {
  apfc: 40,
  guide_repartition: 20,
  pv_guide_repartition: 20,
  pv_identification_physique: 20,
};

// ─── Helpers partagés ──────────────────────────────────────────────────────────

export function getBadgeConfig(lot: LotRecord): { status: LotStatus; label: string } {
  if (lot.verrouille) return { status: "litige", label: "Gel juridique" };
  switch ((lot.statut ?? "").toLowerCase()) {
    case "attribue": return { status: "attribue", label: "Attribué" };
    case "occupe": return { status: "attribue", label: "Occupé" };
    case "vendu": return { status: "attribue", label: "Vendu" };
    case "en_validation": return { status: "en_validation", label: "En validation" };
    case "en_litige": return { status: "litige", label: "Litige" };
    case "reserve_equipement": return { status: "en_validation", label: "Équipement" };
    default: return { status: "disponible", label: "Disponible" };
  }
}

// Un lot transmis depuis un collectif d'ayants-droit (rang 1) vers un nouveau
// titulaire (rang > 1) exige un PV de réunion de famille validé. Renvoie l'info
// PV si elle manque/n'est pas valide, sinon null (rien à signaler).
export function lotPvAlert(
  lot: LotRecord,
  pvByCollectif: Map<string, PvInfo>
): PvInfo | null {
  const attrs = lot.attributions ?? [];
  const r1 = attrs.find((a) => a.rang === 1);
  if (!r1 || r1.attributaires?.type !== "collectif_ayants_droit") return null;
  if (!attrs.some((a) => (a.rang ?? 0) > 1)) return null; // pas encore transmis
  const collectifId = r1.attributaires?.id ?? "";
  const pv = pvByCollectif.get(collectifId);
  if (pv && pv.statut === "valide") return null;
  return pv ?? { reference: "—", statut: "a_fournir" };
}

// ─── Dossier foncier d'un lot (lecture seule) ──────────────────────────────────

export function LotDetailModal({ lot, litiges, score, pvAlert, onClose }: {
  lot: LotRecord; litiges: LitigeRow[]; score: ScoreConfiance | null; pvAlert: PvInfo | null; onClose: () => void;
}) {
  const badge = getBadgeConfig(lot);
  const lotissementNom = lot.ilots?.lotissements?.nom ?? "—";
  const commune = lot.ilots?.lotissements?.commune ?? "—";
  const village = lot.ilots?.lotissements?.village;
  const ilotNum = lot.ilots?.numero;
  const historique = [...(lot.attributions ?? [])].sort(
    (a, b) => (a.rang ?? 0) - (b.rang ?? 0)
  );
  const attestation = lot.attestations_cession?.[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-y-auto rounded-[1.75rem] border border-slate-200/70 bg-white shadow-2xl" style={{ maxHeight: "90vh" }}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">Dossier foncier</p>
              <h2 className="mt-1 text-xl font-semibold text-[#0D3B66]">
                Lot {lot.numero_lot}
                {lot.numero_parcelle && <span className="ml-2 text-sm font-normal text-slate-400">— Parcelle {lot.numero_parcelle}</span>}
              </h2>
            </div>
            <Badge status={badge.status}>{badge.label}</Badge>
            {lot.verrouille && <Lock className="h-4 w-4 text-amber-500" />}
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-6 p-6 sm:p-8">
          {/* Localisation */}
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#1E6091]">Localisation</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Lotissement", value: lotissementNom },
                { label: "Îlot", value: ilotNum ? `Îlot ${ilotNum}` : "—" },
                { label: "Commune", value: commune },
                { label: "Village", value: village ?? "—" },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-400">{item.label}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-700">{item.value}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Caractéristiques */}
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#1E6091]">Caractéristiques</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: "Superficie", value: lot.superficie_m2 ? `${Number(lot.superficie_m2).toLocaleString("fr-FR")} m²` : "—" },
                { label: "Nature du droit", value: NATURE_DROIT_LABELS[lot.nature_droit ?? ""] ?? lot.nature_droit ?? "—" },
                { label: "Guide page", value: lot.guide_page ? `Page ${lot.guide_page}` : "—" },
                { label: "Équipement public", value: lot.est_equipement ? "Oui" : "Non" },
                { label: "Gel juridique", value: lot.verrouille ? "Oui" : "Non" },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-400">{item.label}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-700">{item.value}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Alerte PV de réunion de famille */}
          {pvAlert && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200/70 bg-amber-50 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p className="text-xs text-amber-700">
                PV de réunion de famille :{" "}
                <span className="font-semibold">{(pvAlert.statut ?? "").replace(/_/g, " ")}</span>
                {pvAlert.reference && pvAlert.reference !== "—" && ` · réf. ${pvAlert.reference}`}
                {" "}— requis pour la transmission depuis le collectif d&apos;origine.
              </p>
            </div>
          )}

          {/* Attestation de cession */}
          {attestation && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200/70 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700">
              <span className="font-semibold">{attestation.reference}</span>
              <span>· {attestation.statut}</span>
              {!attestation.cession_id && <span className="text-emerald-600/80">· gratuite (1er propriétaire d&apos;origine)</span>}
              <a
                href={`/passeport?ref=${encodeURIComponent(attestation.reference ?? "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1 font-semibold text-emerald-800 underline-offset-2 hover:underline"
              >
                Voir le Passeport public
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* Score de confiance */}
          {score && (
            <section>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#1E6091]">Score de confiance</p>
              <div className="flex flex-wrap items-center gap-4 rounded-xl bg-slate-50 p-4 sm:gap-6">
                <RadialGauge
                  value={score.total}
                  size={88}
                  strokeWidth={9}
                  gradient={score.total >= 70 ? ["#16A34A", "#4ADE80"] : score.total >= 40 ? ["#D97706", "#FBBF24"] : ["#DC2626", "#F87171"]}
                >
                  <span className="text-lg font-bold tracking-tight text-slate-700">{score.total}</span>
                </RadialGauge>
                <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3">
                  {(Object.keys(SCORE_LABELS) as (keyof typeof SCORE_LABELS)[]).map((key) => (
                    <div key={key} className="rounded-lg bg-white p-2 text-center shadow-sm">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400">{SCORE_LABELS[key]}</p>
                      <p className="text-sm font-semibold text-slate-700">{score[key]}/{SCORE_MAX[key]}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Historique de propriété */}
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#1E6091]">Historique de propriété</p>
            {historique.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                {badge.status === "attribue"
                  ? "Ce lot est attribué, mais le détail de l'attribution est réservé à certains rôles (admin, chefferie, opérateur, vérificateur, commissaire…)."
                  : "Aucune attribution enregistrée — lot libre."}
              </div>
            ) : (
              <ol className="relative space-y-4 border-l-2 border-slate-200 pl-5">
                {historique.map((a, idx) => (
                  <li key={`${a.attributaires?.id ?? "attr"}-${idx}`} className="relative">
                    <span
                      className={`absolute -left-[1.6rem] top-1 h-3 w-3 rounded-full border-2 border-white ${
                        a.actuel ? "bg-[#2D8F5A]" : "bg-slate-300"
                      }`}
                    />
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800">{a.attributaires?.nom ?? "—"}</p>
                      {a.actuel && (
                        <span className="rounded bg-[#2D8F5A]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#2D8F5A]">ACTUEL</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {QUALITE_LABELS[a.qualite ?? ""] ?? a.qualite ?? "—"}
                      {a.attributaires?.type === "collectif_ayants_droit" && " · collectif"}
                      {a.observation && ` · ${a.observation}`}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* Litiges */}
          {litiges.length > 0 && (
            <section>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#EF4444]">Litiges</p>
              <div className="space-y-2">
                {litiges.map((l) => (
                  <div key={l.id} className="flex items-center justify-between rounded-xl border border-red-100 bg-red-50/50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{l.objet ?? "—"}</p>
                      {l.ouvert_le && <p className="mt-0.5 text-xs text-slate-500">Ouvert le {new Date(l.ouvert_le).toLocaleDateString("fr-FR")}</p>}
                    </div>
                    <span className="text-xs font-semibold text-[#EF4444]">{STATUT_LITIGE_LABELS[l.statut ?? ""] ?? l.statut}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Observation */}
          {lot.observation && (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#1E6091]">Observation</p>
              <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{lot.observation}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
