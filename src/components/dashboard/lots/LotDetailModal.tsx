"use client";

import type * as React from "react";
import { AlertTriangle, ExternalLink, Lock } from "lucide-react";
import { Badge } from "@/components/ds/badge";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ds/dialog";
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

/**
 * Correspondance statut de lot → ton du Design System, pour que le registre, le
 * dossier et les dashboards de rôle parlent la même langue chromatique.
 * Exportée : les appelants affichent leur badge eux-mêmes.
 */
export const LOT_STATUS_TONE: Record<LotStatus, "success" | "accent" | "warning" | "danger"> = {
  disponible: "success",
  attribue: "accent",
  en_validation: "warning",
  litige: "danger",
};

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
    <Dialog open onOpenChange={(ouvert) => { if (!ouvert) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <p className="text-[11px] font-bold tracking-[0.18em] text-accent uppercase">Dossier foncier</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <DialogTitle>
              Lot {lot.numero_lot}
              {lot.numero_parcelle && (
                <span className="ml-2 text-sm font-normal text-muted-2">— Parcelle {lot.numero_parcelle}</span>
              )}
            </DialogTitle>
            <Badge tone={LOT_STATUS_TONE[badge.status]}>{badge.label}</Badge>
            {lot.verrouille && <Lock className="size-4 text-warning" aria-label="Gel juridique" />}
          </div>
        </DialogHeader>

        <DialogBody className="space-y-6">
          {/* Localisation */}
          <Section titre="Localisation">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Lotissement", value: lotissementNom },
                { label: "Îlot", value: ilotNum ? `Îlot ${ilotNum}` : "—" },
                { label: "Commune", value: commune },
                { label: "Village", value: village ?? "—" },
              ].map((item) => (
                <Fiche key={item.label} label={item.label} value={item.value} />
              ))}
            </div>
          </Section>

          {/* Caractéristiques */}
          <Section titre="Caractéristiques">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: "Superficie", value: lot.superficie_m2 ? `${Number(lot.superficie_m2).toLocaleString("fr-FR")} m²` : "—" },
                { label: "Nature du droit", value: NATURE_DROIT_LABELS[lot.nature_droit ?? ""] ?? lot.nature_droit ?? "—" },
                { label: "Guide page", value: lot.guide_page ? `Page ${lot.guide_page}` : "—" },
                { label: "Équipement public", value: lot.est_equipement ? "Oui" : "Non" },
                { label: "Gel juridique", value: lot.verrouille ? "Oui" : "Non" },
              ].map((item) => (
                <Fiche key={item.label} label={item.label} value={item.value} />
              ))}
            </div>
          </Section>

          {/* Alerte PV de réunion de famille */}
          {pvAlert && (
            <div className="flex items-start gap-2.5 rounded-xl border border-warning/25 bg-warning-subtle p-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              <p className="text-xs text-warning">
                PV de réunion de famille :{" "}
                <span className="font-semibold">{(pvAlert.statut ?? "").replace(/_/g, " ")}</span>
                {pvAlert.reference && pvAlert.reference !== "—" && ` · réf. ${pvAlert.reference}`}
                {" "}— requis pour la transmission depuis le collectif d&apos;origine.
              </p>
            </div>
          )}

          {/* Attestation de cession */}
          {attestation && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-success/25 bg-success-subtle px-3 py-2.5 text-xs text-success">
              <span className="font-semibold">{attestation.reference}</span>
              <span>· {attestation.statut}</span>
              {!attestation.cession_id && <span className="opacity-80">· gratuite (1er propriétaire d&apos;origine)</span>}
              <a
                href={`/passeport?ref=${encodeURIComponent(attestation.reference ?? "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1 font-semibold underline-offset-2 hover:underline"
              >
                Voir le Passeport public
                <ExternalLink className="size-3" aria-hidden />
              </a>
            </div>
          )}

          {/* Score de confiance */}
          {score && (
            <Section titre="Score de confiance">
              <div className="flex flex-wrap items-center gap-4 rounded-xl bg-inset p-4 sm:gap-6">
                {/* Les hex du dégradé sont ceux des jetons sémantiques
                    (`--success` / `--warning` / `--danger`), identiques en clair
                    et en sombre par décision de la refonte : le SVG peut donc
                    les porter en dur sans casser le thème. */}
                <RadialGauge
                  value={score.total}
                  size={88}
                  strokeWidth={9}
                  gradient={score.total >= 70 ? ["#16A34A", "#4ADE80"] : score.total >= 40 ? ["#D97706", "#FBBF24"] : ["#DC2626", "#F87171"]}
                >
                  <span className="text-lg font-bold tracking-tight text-foreground">{score.total}</span>
                </RadialGauge>
                <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3">
                  {(Object.keys(SCORE_LABELS) as (keyof typeof SCORE_LABELS)[]).map((key) => (
                    <div key={key} className="rounded-lg border border-border bg-card p-2 text-center">
                      <p className="text-[10px] tracking-wide text-muted-2 uppercase">{SCORE_LABELS[key]}</p>
                      <p className="tabular text-sm font-semibold text-foreground">{score[key]}/{SCORE_MAX[key]}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Section>
          )}

          {/* Historique de propriété */}
          <Section titre="Historique de propriété">
            {historique.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-inset p-4 text-sm text-muted-foreground">
                {badge.status === "attribue"
                  ? "Ce lot est attribué, mais le détail de l'attribution est réservé à certains rôles (admin, chefferie, opérateur, vérificateur, commissaire…)."
                  : "Aucune attribution enregistrée — lot libre."}
              </div>
            ) : (
              <ol className="relative space-y-4 border-l-2 border-border pl-5">
                {historique.map((a, idx) => (
                  <li key={`${a.attributaires?.id ?? "attr"}-${idx}`} className="relative">
                    <span
                      className={`absolute -left-[1.6rem] top-1 size-3 rounded-full border-2 border-card ${
                        a.actuel ? "bg-success" : "bg-border-strong"
                      }`}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{a.attributaires?.nom ?? "—"}</p>
                      {a.actuel && (
                        <span className="rounded bg-success-subtle px-1.5 py-0.5 text-[10px] font-bold text-success">ACTUEL</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {QUALITE_LABELS[a.qualite ?? ""] ?? a.qualite ?? "—"}
                      {a.attributaires?.type === "collectif_ayants_droit" && " · collectif"}
                      {a.observation && ` · ${a.observation}`}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          {/* Litiges */}
          {litiges.length > 0 && (
            <Section titre="Litiges" ton="danger">
              <div className="space-y-2">
                {litiges.map((l) => (
                  <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-danger/20 bg-danger-subtle px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{l.objet ?? "—"}</p>
                      {l.ouvert_le && <p className="mt-0.5 text-xs text-muted-foreground">Ouvert le {new Date(l.ouvert_le).toLocaleDateString("fr-FR")}</p>}
                    </div>
                    <span className="text-xs font-semibold text-danger">{STATUT_LITIGE_LABELS[l.statut ?? ""] ?? l.statut}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Observation */}
          {lot.observation && (
            <Section titre="Observation">
              <p className="rounded-xl bg-inset p-3 text-sm text-foreground">{lot.observation}</p>
            </Section>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

/** Intertitre du dossier — même graisse partout, le ton signale la gravité. */
function Section({
  titre,
  ton = "accent",
  children,
}: {
  titre: string;
  ton?: "accent" | "danger";
  children: React.ReactNode;
}) {
  return (
    <section>
      <p
        className={`mb-3 text-[11px] font-bold tracking-[0.18em] uppercase ${
          ton === "danger" ? "text-danger" : "text-accent"
        }`}
      >
        {titre}
      </p>
      {children}
    </section>
  );
}

/** Couple libellé / valeur des grilles d'identité du lot. */
function Fiche({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-inset p-3">
      <p className="text-xs text-muted-2">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
