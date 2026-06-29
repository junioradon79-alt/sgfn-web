"use client";

import { type FormEvent, useEffect, useState } from "react";
import {
  AlertTriangle, ArrowRightLeft, Eye, Filter, Lock, Plus, Search, X,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/utils/supabase/client";
import { useProfile } from "@/hooks/useProfile";

// ─── Types ──────────────────────────────────────────────────────────────────

type LotStatus = "disponible" | "attribue" | "en_validation" | "litige";

type LotRecord = {
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

type PvInfo = { reference: string | null; statut: string | null };

type IlotOption = {
  id: string;
  numero: string | null;
  lotissements?: { nom: string | null; commune: string | null } | null;
};

type AttributaireOption = { id: string; nom: string | null };

type LitigeRow = {
  id: string;
  objet: string | null;
  statut: string | null;
  ouvert_le: string | null;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const NATURE_DROIT_LABELS: Record<string, string> = {
  droit_coutumier: "Droit coutumier",
  attestation_villageoise: "Attestation villageoise",
  certificat_foncier: "Certificat foncier",
  acd: "ACD",
  titre_foncier: "Titre foncier",
};

const NATURE_DROIT_OPTIONS = Object.entries(NATURE_DROIT_LABELS).map(([value, label]) => ({ value, label }));

const QUALITE_OPTIONS = [
  { value: "ayant_droit", label: "Ayant droit" },
  { value: "ayant_droit_transmission", label: "Ayant droit (transmission)" },
  { value: "acquereur", label: "Acquéreur" },
  { value: "operateur", label: "Opérateur" },
  { value: "entrepreneur", label: "Entrepreneur" },
  { value: "reservataire", label: "Réservataire" },
];

const STATUT_LITIGE_LABELS: Record<string, string> = {
  ouvert: "Ouvert", en_mediation: "En médiation", tranche: "Tranché", clos: "Clos",
};

// ─── Badge helper ─────────────────────────────────────────────────────────────

function getBadgeConfig(lot: LotRecord): { status: LotStatus; label: string } {
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

// ─── PV de réunion de famille ───────────────────────────────────────────────
// Un lot transmis depuis un collectif d'ayants-droit (rang 1) vers un nouveau
// titulaire (rang > 1) exige un PV de réunion de famille validé. Renvoie l'info
// PV si elle manque/n'est pas valide, sinon null (rien à signaler).
function lotPvAlert(
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

const QUALITE_LABELS: Record<string, string> = {
  ayant_droit: "Ayant droit",
  ayant_droit_transmission: "Ayant droit (transmission)",
  acquereur: "Acquéreur",
  operateur: "Opérateur",
  entrepreneur: "Entrepreneur",
  reservataire: "Réservataire",
};

// ─── Select helper ────────────────────────────────────────────────────────────

function SelectField({ id, label, value, onChange, children, required }: {
  id: string; label: string; value: string;
  onChange: (v: string) => void; children: React.ReactNode; required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10"
      >
        {children}
      </select>
    </div>
  );
}

// ─── Lot Detail Modal ─────────────────────────────────────────────────────────

function LotDetailModal({ lot, litiges, pvAlert, onClose }: {
  lot: LotRecord; litiges: LitigeRow[]; pvAlert: PvInfo | null; onClose: () => void;
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
              {!attestation.cession_id && <span className="text-emerald-600/80">· gratuite (1er ayant-droit)</span>}
            </div>
          )}

          {/* Historique de propriété */}
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#1E6091]">Historique de propriété</p>
            {historique.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                Aucune attribution enregistrée — lot libre.
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

// ─── Attribution Modal ────────────────────────────────────────────────────────

function AttributionModal({ lot, attributaires, onClose, onSubmit, isSubmitting }: {
  lot: LotRecord;
  attributaires: AttributaireOption[];
  onClose: () => void;
  onSubmit: (data: { attributaire_id: string; qualite: string; actuel: boolean; depuis: string; observation: string }) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [form, setForm] = useState({
    attributaire_id: "",
    qualite: "ayant_droit",
    actuel: true,
    depuis: new Date().toISOString().slice(0, 10),
    observation: "",
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.attributaire_id) { setError("Sélectionnez un attributaire."); return; }
    setError(null);
    await onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[1.75rem] border border-slate-200/70 bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">Transférer</p>
            <h2 className="mt-2 text-xl font-semibold text-[#0D3B66]">Attribuer le Lot {lot.numero_lot}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <SelectField id="attr-attributaire" label="Attributaire" value={form.attributaire_id} onChange={(v) => setForm((f) => ({ ...f, attributaire_id: v }))} required>
            <option value="">— Sélectionner —</option>
            {attributaires.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
          </SelectField>

          <SelectField id="attr-qualite" label="Qualité" value={form.qualite} onChange={(v) => setForm((f) => ({ ...f, qualite: v }))}>
            {QUALITE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </SelectField>

          <div className="space-y-1.5">
            <label htmlFor="attr-depuis" className="text-sm font-medium text-slate-700">Date d'effet</label>
            <input
              id="attr-depuis" type="date" value={form.depuis}
              onChange={(e) => setForm((f) => ({ ...f, depuis: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10"
            />
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/70 px-4 py-3 text-sm text-slate-700">
            <input type="checkbox" checked={form.actuel} onChange={(e) => setForm((f) => ({ ...f, actuel: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-[#0D3B66] focus:ring-[#0D3B66]" />
            Attribution actuelle (met le lot en statut "Attribué")
          </label>

          <div className="space-y-1.5">
            <label htmlFor="attr-obs" className="text-sm font-medium text-slate-700">Observation</label>
            <textarea id="attr-obs" value={form.observation} rows={2} onChange={(e) => setForm((f) => ({ ...f, observation: e.target.value }))}
              placeholder="Remarques, conditions…"
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10" />
          </div>

          {error && <div className="rounded-2xl border border-red-200/70 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="rounded-full border border-slate-200/70 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Annuler</button>
            <button type="submit" disabled={isSubmitting} className="rounded-full bg-[#0D3B66] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E6091] disabled:opacity-70">
              {isSubmitting ? "Enregistrement…" : "Confirmer l'attribution"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Litige Modal ─────────────────────────────────────────────────────────────

function LitigeModal({ lot, onClose, onSubmit, isSubmitting }: {
  lot: LotRecord;
  onClose: () => void;
  onSubmit: (data: { objet: string; notes: string }) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [form, setForm] = useState({ objet: "", notes: "" });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.objet.trim()) { setError("L'objet est obligatoire."); return; }
    setError(null);
    await onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[1.75rem] border border-slate-200/70 bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#EF4444]">Nouveau dossier</p>
            <h2 className="mt-2 text-xl font-semibold text-[#0D3B66]">Déclarer un litige — Lot {lot.numero_lot}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Lot info reminder */}
        <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <span className="font-semibold text-slate-700">Lot {lot.numero_lot}</span>
          {lot.ilots?.lotissements?.nom && ` — ${lot.ilots.lotissements.nom}`}
          {lot.ilots?.numero && `, Îlot ${lot.ilots.numero}`}
        </div>

        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <label htmlFor="litige-objet" className="text-sm font-medium text-slate-700">Objet du litige <span className="text-red-500">*</span></label>
            <input id="litige-objet" type="text" value={form.objet} onChange={(e) => setForm((f) => ({ ...f, objet: e.target.value }))} required
              placeholder="Ex. Contestation de limites de parcelle"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="litige-notes" className="text-sm font-medium text-slate-700">Notes</label>
            <textarea id="litige-notes" value={form.notes} rows={3} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Contexte, parties impliquées, pièces jointes…"
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10" />
          </div>

          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200/70 bg-amber-50 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-xs text-amber-700">L'ouverture d'un dossier de litige est définitive et consignée dans le journal d'audit.</p>
          </div>

          {error && <div className="rounded-2xl border border-red-200/70 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="rounded-full border border-slate-200/70 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Annuler</button>
            <button type="submit" disabled={isSubmitting} className="rounded-full bg-[#EF4444] px-4 py-2 text-sm font-medium text-white hover:bg-[#DC2626] disabled:opacity-70">
              {isSubmitting ? "Ouverture…" : "Ouvrir le dossier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABLE_HEADERS = ["Lot", "Lotissement & Localité", "Attributaire", "Statut", "Actions"] as const;

const EMPTY_FORM = {
  ilot_id: "",
  numero_lot: "",
  est_equipement: false,
};

export default function LotsPage() {
  const supabase = createClient();
  const { isAdmin } = useProfile();

  const [lotRows, setLotRows] = useState<LotRecord[]>([]);
  const [ilotOptions, setIlotOptions] = useState<IlotOption[]>([]);
  const [attributaireOptions, setAttributaireOptions] = useState<AttributaireOption[]>([]);
  const [pvByCollectif, setPvByCollectif] = useState<Map<string, PvInfo>>(new Map());
  const [pvFilter, setPvFilter] = useState(false);
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detailLot, setDetailLot] = useState<LotRecord | null>(null);
  const [lotLitiges, setLotLitiges] = useState<LitigeRow[]>([]);
  const [transfertLot, setTransfertLot] = useState<LotRecord | null>(null);
  const [litigeLot, setLitigeLot] = useState<LotRecord | null>(null);

  // Create form
  const [formState, setFormState] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadLots = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from("lots")
      .select(
        "id, numero_lot, numero_parcelle, ilot_id, statut, verrouille, superficie_m2, est_equipement, nature_droit, observation, guide_page, ilots(id, numero, lotissements(nom, commune, village)), attributions(rang, qualite, actuel, depuis, observation, attributaires(id, nom, type)), attestations_cession(reference, statut, cession_id)"
      )
      .order("numero_lot", { ascending: true });
    setLotRows((data ?? []) as unknown as LotRecord[]);
    setIsLoading(false);
  };

  useEffect(() => {
    void loadLots();

    supabase
      .from("ilots")
      .select("id, numero, lotissements(nom, commune)")
      .order("numero", { ascending: true })
      .then(({ data }) => setIlotOptions((data ?? []) as unknown as IlotOption[]));

    supabase
      .from("attributaires")
      .select("id, nom")
      .order("nom")
      .then(({ data }) => setAttributaireOptions((data ?? []) as AttributaireOption[]));

    // PV de réunion de famille, indexés par collectif d'ayants-droit.
    supabase
      .from("pv_reunions_famille")
      .select("reference, statut, collectif_attributaire_id")
      .then(({ data }) => {
        const map = new Map<string, PvInfo>();
        (data ?? []).forEach((p) => {
          if (p.collectif_attributaire_id) {
            map.set(p.collectif_attributaire_id, { reference: p.reference, statut: p.statut });
          }
        });
        setPvByCollectif(map);
      });
  }, []);

  // Load litiges when a lot detail is opened
  useEffect(() => {
    if (!detailLot) { setLotLitiges([]); return; }
    supabase
      .from("litiges")
      .select("id, objet, statut, ouvert_le")
      .eq("lot_id", detailLot.id)
      .then(({ data }) => setLotLitiges((data ?? []) as LitigeRow[]));
  }, [detailLot]);

  const handleCreateSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formState.numero_lot.trim()) {
      setErrorMessage("Le numéro de lot est obligatoire.");
      return;
    }
    if (!formState.ilot_id) {
      setErrorMessage("Sélectionnez un îlot.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const { error } = await (supabase.from("lots") as any).insert([{
      numero_lot: formState.numero_lot.trim(),
      ilot_id: formState.ilot_id,
      est_equipement: formState.est_equipement,
    }]);

    if (error) {
      setErrorMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    setFormState(EMPTY_FORM);
    setIsModalOpen(false);
    setIsSubmitting(false);
    setSuccessMessage("Parcelle enregistrée avec succès.");
    setTimeout(() => setSuccessMessage(null), 4000);
    await loadLots();
  };

  const handleAttributionSubmit = async (data: { attributaire_id: string; qualite: string; actuel: boolean; depuis: string; observation: string }) => {
    if (!transfertLot) return;
    setIsSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from("attributions").insert([{
      lot_id: transfertLot.id,
      attributaire_id: data.attributaire_id,
      qualite: data.qualite as any,
      actuel: data.actuel,
      depuis: data.depuis || null,
      observation: data.observation.trim() || null,
      operateur_id: user?.id ?? null,
    }] as any);

    if (data.actuel) {
      await supabase.from("lots").update({ statut: "attribue" } as any).eq("id", transfertLot.id);
    }

    setTransfertLot(null);
    setIsSubmitting(false);
    setSuccessMessage("Attribution enregistrée.");
    setTimeout(() => setSuccessMessage(null), 4000);
    await loadLots();
  };

  const handleLitigeSubmit = async (data: { objet: string; notes: string }) => {
    if (!litigeLot) return;
    setIsSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();

    await (supabase.from("litiges") as any).insert([{
      lot_id: litigeLot.id,
      objet: data.objet.trim(),
      notes: data.notes.trim() || null,
      statut: "ouvert",
      cree_par: user?.id ?? null,
    }]);

    await supabase.from("lots").update({ statut: "en_litige" } as any).eq("id", litigeLot.id);

    setLitigeLot(null);
    setIsSubmitting(false);
    setSuccessMessage("Dossier de litige ouvert.");
    setTimeout(() => setSuccessMessage(null), 4000);
    await loadLots();
  };

  // Group ilots by lotissement for the select
  const ilotGroups = ilotOptions.reduce<Record<string, IlotOption[]>>((acc, ilot) => {
    const key = ilot.lotissements?.nom ?? "Sans lotissement";
    if (!acc[key]) acc[key] = [];
    acc[key].push(ilot);
    return acc;
  }, {});

  const pvAlertCount = lotRows.filter((l) => lotPvAlert(l, pvByCollectif)).length;
  const displayedRows = lotRows
    .filter((l) => !pvFilter || lotPvAlert(l, pvByCollectif))
    .filter((l) => {
      if (!search) return true;
      const q = search.toLowerCase();
      const num = String(l.numero_lot ?? "").toLowerCase();
      const parcelle = (l.numero_parcelle ?? "").toLowerCase();
      const attrNom = (l.attributions?.find((a) => a.actuel) ?? l.attributions?.[0])?.attributaires?.nom?.toLowerCase() ?? "";
      const lotissement = (l.ilots?.lotissements?.nom ?? "").toLowerCase();
      return num.includes(q) || parcelle.includes(q) || attrNom.includes(q) || lotissement.includes(q);
    })
    .filter((l) => !statutFilter || (l.statut ?? "disponible") === statutFilter);

  return (
    <div className="mx-auto max-w-6xl">
      {/* En-tête */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-primary">Gestion des Lots</h1>
          <p className="mt-1.5 text-sm text-slate-500">Suivi, traçabilité et statut juridique des parcelles cadastrales enregistrées.</p>
        </div>
        <button type="button" onClick={() => { setIsModalOpen(true); setErrorMessage(null); setSuccessMessage(null); }}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#0D3B66] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-300 hover:bg-[#1E6091] hover:shadow-md active:scale-[0.98]">
          <Plus className="h-4 w-4" />
          Ajouter un lot
        </button>
      </div>

      {successMessage && (
        <div className="mb-4 rounded-2xl border border-emerald-200/80 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{successMessage}</div>
      )}

      {/* Barre de recherche */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            placeholder="Rechercher un lot, un attributaire…"
            className="pl-9"
            aria-label="Rechercher un lot"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="relative">
          <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <select
            value={statutFilter}
            onChange={(e) => setStatutFilter(e.target.value)}
            className="appearance-none rounded-lg border border-slate-200/60 bg-white py-2 pl-9 pr-8 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:border-slate-300 focus:border-[#0D3B66] focus:outline-none"
            aria-label="Filtrer par statut"
          >
            <option value="">Tous les statuts</option>
            <option value="disponible">Disponible</option>
            <option value="attribue">Attribué</option>
            <option value="occupe">Occupé</option>
            <option value="vendu">Vendu</option>
            <option value="en_validation">En validation</option>
            <option value="en_litige">Litige</option>
            <option value="reserve_equipement">Équipement</option>
          </select>
        </div>
      </div>

      {/* Bandeau d'alerte PV de réunion de famille */}
      {pvAlertCount > 0 && (
        <button
          type="button"
          onClick={() => setPvFilter((v) => !v)}
          className={`mb-4 flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
            pvFilter
              ? "border-amber-300 bg-amber-100 text-amber-800"
              : "border-amber-200/70 bg-amber-50 text-amber-700 hover:bg-amber-100/70"
          }`}
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
          <span>
            <span className="font-semibold">{pvAlertCount} lot{pvAlertCount > 1 ? "s" : ""}</span>{" "}
            en attente d&apos;un PV de réunion de famille (transmission par un collectif d&apos;ayants-droit).
          </span>
          <span className="ml-auto shrink-0 font-semibold underline">
            {pvFilter ? "Tout afficher" : "Voir"}
          </span>
        </button>
      )}

      {/* Tableau */}
      <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200/60 bg-slate-50/50">
                {TABLE_HEADERS.map((header) => (
                  <th key={header} scope="col" className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500 last:text-right">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60">
              {isLoading ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">Chargement des lots…</td></tr>
              ) : displayedRows.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">{search || statutFilter ? "Aucun lot ne correspond à votre recherche." : pvFilter ? "Aucun lot avec un PV à régulariser." : "Aucun lot enregistré."}</td></tr>
              ) : (
                displayedRows.map((lot) => {
                  const badge = getBadgeConfig(lot);
                  const lotissementNom = lot.ilots?.lotissements?.nom;
                  const commune = lot.ilots?.lotissements?.commune;
                  const ilotNum = lot.ilots?.numero;
                  const attrActuel = lot.attributions?.find((a) => a.actuel) ?? lot.attributions?.[0];

                  return (
                    <tr key={lot.id} className="transition-colors hover:bg-slate-50/60">
                      {/* Lot */}
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-[#0D3B66]">Lot {lot.numero_lot}</p>
                        {lot.numero_parcelle && <p className="mt-0.5 text-xs text-slate-400">Parc. {lot.numero_parcelle}</p>}
                        {lot.verrouille && <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-600"><Lock className="h-3 w-3" />Gelé</span>}
                      </td>

                      {/* Lotissement & localité */}
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-slate-800">{lotissementNom ?? "—"}</p>
                        <div className="mt-0.5 flex items-center gap-2">
                          {ilotNum && (
                            <span className="inline-flex items-center rounded-md bg-[#0D3B66]/8 px-1.5 py-0.5 text-xs font-semibold text-[#0D3B66]">
                              Îlot {ilotNum}
                            </span>
                          )}
                          {commune && <span className="text-xs text-slate-400">{commune}</span>}
                        </div>
                      </td>

                      {/* Attributaire */}
                      <td className="px-5 py-4 text-sm text-slate-700">
                        {attrActuel?.attributaires?.nom ?? <span className="text-slate-400">Non attribué</span>}
                      </td>

                      {/* Statut */}
                      <td className="px-5 py-4">
                        <Badge status={badge.status}>{badge.label}</Badge>
                        {lotPvAlert(lot, pvByCollectif) && (
                          <span className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-600">
                            <AlertTriangle className="h-3 w-3" />PV à régulariser
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => setDetailLot(lot)}
                            title="Voir le dossier"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#0D3B66]"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setTransfertLot(lot)}
                              title="Transférer / Attribuer"
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#1E6091]"
                            >
                              <ArrowRightLeft className="h-4 w-4" />
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setLitigeLot(lot)}
                              title="Déclarer un litige"
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-[#EF4444]"
                            >
                              <AlertTriangle className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal création lot */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-y-auto rounded-[1.75rem] border border-slate-200/70 bg-white p-6 shadow-[0_30px_80px_-20px_rgba(2,8,23,0.35)] sm:p-8" style={{ maxHeight: "92vh" }}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">Nouveau lot</p>
                <h2 className="mt-2 text-xl font-semibold text-[#0D3B66]">Créer une parcelle foncière</h2>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600" aria-label="Fermer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={handleCreateSubmit}>
              <div className="space-y-1.5">
                <label htmlFor="lot-numero" className="text-sm font-medium text-slate-700">Numéro de lot <span className="text-red-500">*</span></label>
                <Input id="lot-numero" type="text" value={formState.numero_lot} onChange={(e) => setFormState((f) => ({ ...f, numero_lot: e.target.value }))} placeholder="Ex. 042" required />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="lot-ilot" className="text-sm font-medium text-slate-700">ID de l’îlot <span className="text-red-500">*</span></label>
                <select
                  id="lot-ilot"
                  value={formState.ilot_id}
                  onChange={(e) => setFormState((f) => ({ ...f, ilot_id: e.target.value }))}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm transition-colors focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10"
                >
                  <option value="">— Sélectionner un îlot —</option>
                  {Object.entries(ilotGroups).map(([lotNom, ilots]) => (
                    <optgroup key={lotNom} label={lotNom}>
                      {ilots.map((ilot) => (
                        <option key={ilot.id} value={ilot.id}>Îlot {ilot.numero} — {ilot.lotissements?.commune ?? ""}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/70 px-4 py-3 text-sm text-slate-700 transition-colors hover:border-slate-300">
                <input type="checkbox" checked={formState.est_equipement} onChange={(e) => setFormState((f) => ({ ...f, est_equipement: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-[#0D3B66] focus:ring-[#0D3B66]" />
                Type d’équipement
              </label>

              {errorMessage && (
                <div className="rounded-2xl border border-red-200/70 bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</div>
              )}

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-full border border-slate-200/70 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50">Annuler</button>
                <button type="submit" disabled={isSubmitting} className="rounded-full bg-[#0D3B66] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1E6091] disabled:opacity-70">
                  {isSubmitting ? "Enregistrement…" : "Enregistrer la parcelle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modals d'action */}
      {detailLot && <LotDetailModal lot={detailLot} litiges={lotLitiges} pvAlert={lotPvAlert(detailLot, pvByCollectif)} onClose={() => setDetailLot(null)} />}
      {transfertLot && <AttributionModal lot={transfertLot} attributaires={attributaireOptions} isSubmitting={isSubmitting} onClose={() => setTransfertLot(null)} onSubmit={handleAttributionSubmit} />}
      {litigeLot && <LitigeModal lot={litigeLot} isSubmitting={isSubmitting} onClose={() => setLitigeLot(null)} onSubmit={handleLitigeSubmit} />}
    </div>
  );
}
