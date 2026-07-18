"use client";

import { type FormEvent, useEffect, useState } from "react";
import {
  AlertTriangle, ArrowRightLeft, Banknote, Eye, Filter, Lock, Plus, Search, X,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { BoutonImprimer } from "@/components/dashboard/BoutonImprimer";
import {
  LotDetailModal, getBadgeConfig, lotPvAlert,
  type LotRecord, type PvInfo, type ScoreConfiance, type LitigeRow,
} from "@/components/dashboard/lots/LotDetailModal";
import { createClient } from "@/utils/supabase/client";
import { useChargement } from "@/hooks/useChargement";
import { useProfile } from "@/hooks/useProfile";
import { MOYEN_OPTIONS, fcfa, type MoyenPaiement } from "@/lib/paiements";
import { fetchAllPages } from "@/lib/supabase-pagination";
import type { Database } from "../../../../database.types";

// ─── Types (spécifiques à la page) ─────────────────────────────────────────────

type IlotOption = {
  id: string;
  numero: string | null;
  lotissements?: { nom: string | null; commune: string | null } | null;
};

type AttributaireOption = { id: string; nom: string | null };

type TarifTier2 = { montant_min: number | null; commission_min: number | null; actif: boolean };
type TarifChefferie = { montant_chefferie: number | null; commission_sgfn: number | null; actif: boolean };

// ─── Constants ───────────────────────────────────────────────────────────────

const QUALITE_OPTIONS = [
  { value: "ayant_droit", label: "Propriétaire d'origine" },
  { value: "ayant_droit_transmission", label: "Ayant-droit par transmission" },
  { value: "acquereur", label: "Acquéreur" },
  { value: "operateur", label: "Opérateur" },
  { value: "entrepreneur", label: "Entrepreneur" },
  { value: "reservataire", label: "Réservataire" },
];

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

// ─── Attribution Modal ────────────────────────────────────────────────────────

function AttributionModal({ lot, attributaires, onClose, onSubmit, isSubmitting }: {
  lot: LotRecord;
  attributaires: AttributaireOption[];
  onClose: () => void;
  onSubmit: (data: { attributaire_id: string; qualite: string; actuel: boolean; depuis: string; observation: string }) => Promise<string | null>;
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
    const err = await onSubmit(form);
    if (err) setError(err);
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
            <label htmlFor="attr-depuis" className="text-sm font-medium text-slate-700">Date d&apos;effet</label>
            <input
              id="attr-depuis" type="date" value={form.depuis}
              onChange={(e) => setForm((f) => ({ ...f, depuis: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10"
            />
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-slate-50/70 px-4 py-3 text-sm text-slate-700">
            <input type="checkbox" checked={form.actuel} onChange={(e) => setForm((f) => ({ ...f, actuel: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-[#0D3B66] focus:ring-[#0D3B66]" />
            Attribution actuelle (met le lot en statut &quot;Attribué&quot;)
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
  onSubmit: (data: { objet: string; notes: string }) => Promise<string | null>;
  isSubmitting: boolean;
}) {
  const [form, setForm] = useState({ objet: "", notes: "" });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.objet.trim()) { setError("L'objet est obligatoire."); return; }
    setError(null);
    const err = await onSubmit(form);
    if (err) setError(err);
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
            <p className="text-xs text-amber-700">L&apos;ouverture d&apos;un dossier de litige est définitive et consignée dans le journal d&apos;audit.</p>
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

// ─── Cession Modal ────────────────────────────────────────────────────────────
// Crée le transfert (2e attestation et suivantes) : la 1re attestation
// (rang 1) reste gérée automatiquement et gratuitement par le trigger DB,
// cette modale ne s'occupe que des transferts payants.

function CessionModal({
  lot, attributaires, excludeAttributaireId, nextRang, tarifTier2, tarifChefferie, onClose, onSubmit, isSubmitting,
}: {
  lot: LotRecord;
  attributaires: AttributaireOption[];
  excludeAttributaireId: string | null;
  nextRang: number;
  tarifTier2: TarifTier2 | null;
  tarifChefferie: TarifChefferie | null | undefined;
  onClose: () => void;
  onSubmit: (data: { acquereur_id: string; date_cession: string; observation: string; moyen: MoyenPaiement }) => Promise<string | null>;
  isSubmitting: boolean;
}) {
  const [form, setForm] = useState({
    acquereur_id: "",
    date_cession: new Date().toISOString().slice(0, 10),
    observation: "",
    moyen: "especes" as MoyenPaiement,
  });
  const [error, setError] = useState<string | null>(null);

  const isTier2 = nextRang === 2;
  const tarifDisponible = isTier2 ? !!tarifTier2?.actif : !!tarifChefferie?.actif;
  const montantTotal = isTier2
    ? (tarifTier2?.montant_min ?? 0)
    : ((tarifChefferie?.montant_chefferie ?? 0) + (tarifChefferie?.commission_sgfn ?? 0));
  const partChefferie = isTier2 ? (tarifTier2?.montant_min ?? 0) - (tarifTier2?.commission_min ?? 0) : tarifChefferie?.montant_chefferie ?? 0;
  const commission = isTier2 ? (tarifTier2?.commission_min ?? 0) : (tarifChefferie?.commission_sgfn ?? 0);

  const candidats = attributaires.filter((a) => a.id !== excludeAttributaireId);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.acquereur_id) { setError("Sélectionnez l'acquéreur."); return; }
    setError(null);
    const err = await onSubmit(form);
    if (err) setError(err);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[1.75rem] border border-slate-200/70 bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#1E6091]">Nouvelle cession</p>
            <h2 className="mt-2 text-xl font-semibold text-[#0D3B66]">Lot {lot.numero_lot} — {nextRang}e attestation</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Prévisualisation du tarif */}
        {tarifDisponible ? (
          <div className="mt-5 rounded-2xl border border-[#0D3B66]/15 bg-[#0D3B66]/5 p-4 text-sm text-[#0D3B66]">
            <p className="font-semibold">{fcfa(montantTotal)} au total</p>
            <p className="mt-0.5 text-xs text-[#0D3B66]/70">
              {fcfa(partChefferie)} chefferie + {fcfa(commission)} commission SGNF
            </p>
          </div>
        ) : (
          <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-amber-200/70 bg-amber-50 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-xs text-amber-700">
              {isTier2
                ? "Tarif de la 2e attestation non configuré — contactez l'équipe SGNF."
                : "Tarif non défini pour la chefferie de ce lotissement (3e attestation et plus) — contactez l'équipe SGNF pour le fixer."}
            </p>
          </div>
        )}

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <SelectField id="cession-acquereur" label="Acquéreur" value={form.acquereur_id} onChange={(v) => setForm((f) => ({ ...f, acquereur_id: v }))} required>
            <option value="">— Sélectionner —</option>
            {candidats.map((a) => <option key={a.id} value={a.id}>{a.nom}</option>)}
          </SelectField>

          <div className="space-y-1.5">
            <label htmlFor="cession-date" className="text-sm font-medium text-slate-700">Date de cession</label>
            <input
              id="cession-date" type="date" value={form.date_cession}
              onChange={(e) => setForm((f) => ({ ...f, date_cession: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10"
            />
          </div>

          <SelectField id="cession-moyen" label="Moyen de paiement" value={form.moyen} onChange={(v) => setForm((f) => ({ ...f, moyen: v as MoyenPaiement }))}>
            {MOYEN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </SelectField>

          <div className="space-y-1.5">
            <label htmlFor="cession-obs" className="text-sm font-medium text-slate-700">Observation</label>
            <textarea id="cession-obs" value={form.observation} rows={2} onChange={(e) => setForm((f) => ({ ...f, observation: e.target.value }))}
              placeholder="Remarques, conditions…"
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-[#0D3B66] focus:outline-none focus:ring-2 focus:ring-[#0D3B66]/10" />
          </div>

          {error && <div className="rounded-2xl border border-red-200/70 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="rounded-full border border-slate-200/70 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Annuler</button>
            <button type="submit" disabled={isSubmitting || !tarifDisponible} className="rounded-full bg-[#0D3B66] px-4 py-2 text-sm font-medium text-white hover:bg-[#1E6091] disabled:opacity-70">
              {isSubmitting ? "Enregistrement…" : "Créer la cession"}
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
  const { isAdmin, isChefferie, profile } = useProfile();
  const canCreateCession = isAdmin || profile?.groupe === "operateur";

  const [lotRows, setLotRows] = useState<LotRecord[]>([]);
  const [ilotOptions, setIlotOptions] = useState<IlotOption[]>([]);
  const [attributaireOptions, setAttributaireOptions] = useState<AttributaireOption[]>([]);
  const [pvByCollectif, setPvByCollectif] = useState<Map<string, PvInfo>>(new Map());
  const [tarifTier2, setTarifTier2] = useState<TarifTier2 | null>(null);
  const [tarifsChefferie, setTarifsChefferie] = useState<Map<string, TarifChefferie>>(new Map());
  const [pvFilter, setPvFilter] = useState(false);
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState("");


  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detailLot, setDetailLot] = useState<LotRecord | null>(null);
  const [lotLitiges, setLotLitiges] = useState<LitigeRow[]>([]);
  const [scoreConfiance, setScoreConfiance] = useState<ScoreConfiance | null>(null);
  const [transfertLot, setTransfertLot] = useState<LotRecord | null>(null);
  const [litigeLot, setLitigeLot] = useState<LotRecord | null>(null);
  const [cessionLot, setCessionLot] = useState<LotRecord | null>(null);

  // Create form
  const [formState, setFormState] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadLots = async () => {
    // Le registre était chargé en UN seul embed imbriqué à 2 niveaux depuis `lots`
    // (lots→attributions→attributaires et lots→attestations_cession). Depuis le
    // resserrage RLS du 17/07, PostgREST exécute ces embeds en LATERAL par lot en
    // ré-évaluant la RLS ligne à ligne : sur ~900 lots (périmètre chefferie), la
    // requête dépasse le statement_timeout de 8 s → HTTP 500 → « 0 lot enregistré ».
    // On charge donc chaque relation À PLAT (embed ≤ 1 niveau, chacune < 2 s) et on
    // fusionne par lot_id côté client. La forme LotRecord est reconstituée à
    // l'identique — modales, badges et alertes PV inchangés.
    type AttrRow = { lot_id: string | null } & NonNullable<LotRecord["attributions"]>[number];
    type AttestRow = { lot_id: string | null } & NonNullable<LotRecord["attestations_cession"]>[number];

    // Ordre déterministe (numero_lot pour l'affichage, id/uuid comme départage
    // stable) requis par la pagination .range().
    const [lotsData, attrsData, attestData] = await Promise.all([
      fetchAllPages<LotRecord>((from, to) =>
        supabase
          .from("lots")
          .select(
            "id, numero_lot, numero_parcelle, ilot_id, statut, verrouille, superficie_m2, est_equipement, nature_droit, observation, guide_page, ilots(id, numero, lotissements(nom, commune, village, autorite_coutumiere_id))"
          )
          .order("numero_lot", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to) as unknown as PromiseLike<{ data: LotRecord[] | null }>
      ),
      fetchAllPages<AttrRow>((from, to) =>
        supabase
          .from("attributions")
          .select("lot_id, rang, qualite, actuel, depuis, observation, attributaires(id, nom, type)")
          .order("id", { ascending: true })
          .range(from, to) as unknown as PromiseLike<{ data: AttrRow[] | null }>
      ),
      fetchAllPages<AttestRow>((from, to) =>
        supabase
          .from("attestations_cession")
          .select("lot_id, reference, statut, cession_id")
          .order("id", { ascending: true })
          .range(from, to) as unknown as PromiseLike<{ data: AttestRow[] | null }>
      ),
    ]);

    const attrsByLot = new Map<string, NonNullable<LotRecord["attributions"]>>();
    for (const a of attrsData) {
      if (!a.lot_id) continue;
      const { lot_id, ...rest } = a;
      const arr = attrsByLot.get(lot_id);
      if (arr) arr.push(rest);
      else attrsByLot.set(lot_id, [rest]);
    }

    const attestByLot = new Map<string, NonNullable<LotRecord["attestations_cession"]>>();
    for (const at of attestData) {
      if (!at.lot_id) continue;
      const { lot_id, ...rest } = at;
      const arr = attestByLot.get(lot_id);
      if (arr) arr.push(rest);
      else attestByLot.set(lot_id, [rest]);
    }

    const merged = lotsData.map((l) => ({
      ...l,
      attributions: attrsByLot.get(l.id) ?? [],
      attestations_cession: attestByLot.get(l.id) ?? [],
    }));
    setLotRows(merged);
  };

  const { isLoading, recharger } = useChargement(loadLots);

  useEffect(() => {
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

    // Tarifs de la 2e attestation (forfait national) et de la 3e+ (par chefferie).
    supabase
      .from("tarifs")
      .select("montant_min, commission_min, actif")
      .eq("type_demarche", "delivrance_attestation_cession")
      .maybeSingle()
      .then(({ data }) => setTarifTier2(data as TarifTier2 | null));

    supabase
      .from("tarifs_attestation_chefferie")
      .select("autorite_coutumiere_id, montant_chefferie, commission_sgfn, actif")
      .then(({ data }) => {
        const map = new Map<string, TarifChefferie>();
        (data ?? []).forEach((t) => {
          map.set(t.autorite_coutumiere_id, {
            montant_chefferie: t.montant_chefferie,
            commission_sgfn: t.commission_sgfn,
            actif: t.actif,
          });
        });
        setTarifsChefferie(map);
      });
  }, []);

  // Load litiges + score de confiance when a lot detail is opened
  useEffect(() => {
    if (!detailLot) {
      setScoreConfiance(null);
      return;
    }
    supabase
      .from("litiges")
      .select("id, objet, statut, ouvert_le")
      .eq("lot_id", detailLot.id)
      .then(({ data }) => setLotLitiges((data ?? []) as LitigeRow[]));
    supabase
      .rpc("calculer_score_confiance", { p_lot_id: detailLot.id })
      .then(({ data }) => setScoreConfiance((data ?? null) as ScoreConfiance | null));
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

    const { error } = await supabase.from("lots").insert([{
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
    await recharger();
  };

  const handleAttributionSubmit = async (data: { attributaire_id: string; qualite: string; actuel: boolean; depuis: string; observation: string }): Promise<string | null> => {
    if (!transfertLot) return "Aucun lot sélectionné.";
    setIsSubmitting(true);

    // RPC transactionnel : désactive l'ancienne attribution, insère la nouvelle
    // et met à jour le statut du lot en une seule transaction.
    const { error } = await supabase.rpc("transferer_attribution", {
      p_lot_id: transfertLot.id,
      p_attributaire_id: data.attributaire_id,
      p_qualite: data.qualite as Database["public"]["Enums"]["qualite_attribution"],
      p_actuel: data.actuel,
      p_depuis: data.depuis || undefined,
      p_observation: data.observation.trim() || undefined,
    });

    setIsSubmitting(false);
    if (error) return error.message;

    setTransfertLot(null);
    setSuccessMessage("Attribution enregistrée.");
    setTimeout(() => setSuccessMessage(null), 4000);
    await recharger();
    return null;
  };

  const handleLitigeSubmit = async (data: { objet: string; notes: string }): Promise<string | null> => {
    if (!litigeLot) return "Aucun lot sélectionné.";
    setIsSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { error: litigeError } = await supabase.from("litiges").insert([{
      lot_id: litigeLot.id,
      objet: data.objet.trim(),
      notes: data.notes.trim() || null,
      statut: "ouvert",
      cree_par: user?.id ?? null,
    }]);

    if (litigeError) {
      setIsSubmitting(false);
      return `Échec de l'ouverture du litige : ${litigeError.message}`;
    }

    const { error: statutError } = await supabase.from("lots").update({ statut: "en_litige" }).eq("id", litigeLot.id);
    if (statutError) {
      setIsSubmitting(false);
      return `Litige créé mais statut du lot non mis à jour : ${statutError.message}`;
    }

    setLitigeLot(null);
    setIsSubmitting(false);
    setSuccessMessage("Dossier de litige ouvert.");
    setTimeout(() => setSuccessMessage(null), 4000);
    await recharger();
    return null;
  };

  const handleCessionSubmit = async (data: {
    acquereur_id: string; date_cession: string; observation: string; moyen: MoyenPaiement;
  }): Promise<string | null> => {
    if (!cessionLot) return "Aucun lot sélectionné.";
    setIsSubmitting(true);

    const { data: result, error } = await supabase.rpc("creer_cession", {
      p_lot_id: cessionLot.id,
      p_acquereur_id: data.acquereur_id,
      p_date_cession: data.date_cession || undefined,
      p_observation: data.observation.trim() || undefined,
      p_moyen: data.moyen,
    });

    setIsSubmitting(false);

    if (error) return error.message;

    const r = result as {
      rang: number; montant_total: number; statut_paiement: string;
    };
    setCessionLot(null);
    setSuccessMessage(
      `Cession créée (${r.rang}e attestation) — ${fcfa(r.montant_total)}. ` +
      (r.statut_paiement === "en_attente_validation"
        ? "Paiement en attente de validation au guichet (onglet Paiements)."
        : "Paiement en attente de règlement en ligne par l'acquéreur.")
    );
    setTimeout(() => setSuccessMessage(null), 6000);
    await recharger();
    return null;
  };

  // Group ilots by lotissement for the select
  const ilotGroups = ilotOptions.reduce<Record<string, IlotOption[]>>((acc, ilot) => {
    const key = ilot.lotissements?.nom ?? "Sans lotissement";
    if (!acc[key]) acc[key] = [];
    acc[key].push(ilot);
    return acc;
  }, {});

  // Périmètre garanti CÔTÉ SERVEUR par la RLS (`lots_read_scope`, scopée par
  // juridiction / opérateur / famille depuis le 17/07) : la session ne reçoit déjà
  // que les lots qu'elle a le droit de voir. Plus de filtre client de sécurité —
  // l'ancien reposait sur des policies « blanket » qui n'existent plus.
  const scopedRows = lotRows;
  const pvAlertCount = scopedRows.filter((l) => lotPvAlert(l, pvByCollectif)).length;
  const displayedRows = scopedRows
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
    <div className="mx-auto w-full max-w-7xl">
      {/* En-tête */}
      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-[#E3E8EF] bg-white p-5 shadow-[0_1px_3px_rgba(16,24,40,0.06)] sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#0F5E8C]">Registre foncier</p>
          <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-[#0B2E4F] sm:text-3xl">Tableau des lots</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#526176] sm:text-base">Suivi, traçabilité et statut juridique des parcelles cadastrales enregistrées.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <BoutonImprimer />
          {!isChefferie && (
            <button type="button" onClick={() => { setIsModalOpen(true); setErrorMessage(null); setSuccessMessage(null); }}
              className="print:hidden inline-flex h-10 items-center gap-2 rounded-lg bg-[#0B2E4F] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#0F5E8C]">
              <Plus className="h-4 w-4" />
              Ajouter un lot
            </button>
          )}
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[#E3E8EF] bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,0.04)]">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#526176]">Lots affichés</p>
          <p className="mt-2 text-2xl font-extrabold tabular text-[#0B2E4F]">{displayedRows.length}</p>
        </div>
        <div className="rounded-xl border border-[#E3E8EF] bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,0.04)]">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#526176]">PV à régulariser</p>
          <p className="mt-2 text-2xl font-extrabold tabular text-[#B45309]">{pvAlertCount}</p>
        </div>
        <div className="rounded-xl border border-[#E3E8EF] bg-white p-4 shadow-[0_1px_3px_rgba(16,24,40,0.04)]">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#526176]">Filtres</p>
          <p className="mt-2 text-sm font-extrabold text-[#0B2E4F]">{statutFilter || pvFilter || search ? "Vue filtrée" : "Vue complète"}</p>
        </div>
      </div>

      {successMessage && (
        <div className="mb-4 rounded-2xl border border-emerald-200/80 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{successMessage}</div>
      )}

      {/* Barre de recherche */}
      <div className="print:hidden mb-6 flex flex-col gap-3 rounded-2xl border border-[#E3E8EF] bg-white p-3 shadow-[0_1px_3px_rgba(16,24,40,0.04)] sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            placeholder="Rechercher un lot, un attributaire…"
            className="h-10 border-[#C9D5E0] bg-white pl-9"
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
            className="h-10 appearance-none rounded-lg border border-[#C9D5E0] bg-white py-2 pl-9 pr-8 text-sm font-semibold text-[#526176] shadow-sm transition-colors hover:border-[#B8C7D6] focus:border-[#0F5E8C] focus:outline-none focus:ring-2 focus:ring-[#0F5E8C]/20"
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
          className={`print:hidden mb-4 flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
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
      <div className="overflow-hidden rounded-2xl border border-[#E3E8EF] bg-white shadow-[0_1px_3px_rgba(16,24,40,0.06)] print:overflow-visible print:rounded-none print:border-none">
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#E3E8EF] bg-[#F7F9FC]">
                {TABLE_HEADERS.map((header) => (
                  <th key={header} scope="col" className="px-5 py-3.5 text-xs font-bold uppercase tracking-[0.12em] text-[#526176] last:text-right print:last:hidden">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3E8EF]">
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
                    <tr key={lot.id} className="transition-colors hover:bg-[#F7F9FC]">
                      {/* Lot */}
                      <td className="px-5 py-4">
                        <p className="text-sm font-extrabold text-[#0B2E4F]">Lot {lot.numero_lot}</p>
                        {lot.numero_parcelle && <p className="mt-0.5 text-xs text-slate-400">Parc. {lot.numero_parcelle}</p>}
                        {lot.verrouille && <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-600"><Lock className="h-3 w-3" />Gelé</span>}
                      </td>

                      {/* Lotissement & localité */}
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-slate-800">{lotissementNom ?? "—"}</p>
                        <div className="mt-0.5 flex items-center gap-2">
                          {ilotNum && (
                            <span className="inline-flex items-center rounded-md bg-[#0B2E4F]/[0.08] px-1.5 py-0.5 text-xs font-semibold text-[#0B2E4F]">
                              Îlot {ilotNum}
                            </span>
                          )}
                          {commune && <span className="text-xs text-slate-400">{commune}</span>}
                        </div>
                      </td>

                      {/* Attributaire */}
                      <td className="px-5 py-4 text-sm text-slate-700">
                        {attrActuel?.attributaires?.nom ?? (
                          badge.status === "attribue" ? (
                            <span className="text-slate-400 italic" title="Le détail de l'attribution est réservé à certains rôles (admin, chefferie, opérateur, vérificateur, commissaire…).">
                              Non visible pour votre rôle
                            </span>
                          ) : (
                            <span className="text-slate-400">Non attribué</span>
                          )
                        )}
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
                      <td className="px-5 py-4 text-right print:hidden">
                        <div className="inline-flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => { setLotLitiges([]); setDetailLot(lot); }}
                            title="Voir le dossier"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#0B2E4F]"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setTransfertLot(lot)}
                              title="Transférer / Attribuer"
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#0F5E8C]"
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
                          {canCreateCession && attrActuel && (
                            <button
                              type="button"
                              onClick={() => setCessionLot(lot)}
                              title="Créer une cession"
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#2D8F5A]"
                            >
                              <Banknote className="h-4 w-4" />
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
      {detailLot && <LotDetailModal lot={detailLot} litiges={lotLitiges} score={scoreConfiance} pvAlert={lotPvAlert(detailLot, pvByCollectif)} onClose={() => setDetailLot(null)} />}
      {transfertLot && <AttributionModal lot={transfertLot} attributaires={attributaireOptions} isSubmitting={isSubmitting} onClose={() => setTransfertLot(null)} onSubmit={handleAttributionSubmit} />}
      {litigeLot && <LitigeModal lot={litigeLot} isSubmitting={isSubmitting} onClose={() => setLitigeLot(null)} onSubmit={handleLitigeSubmit} />}
      {cessionLot && (() => {
        const attrActuel = cessionLot.attributions?.find((a) => a.actuel) ?? cessionLot.attributions?.[0];
        const nextRang = (attrActuel?.rang ?? 1) + 1;
        const autoriteId = cessionLot.ilots?.lotissements?.autorite_coutumiere_id ?? "";
        return (
          <CessionModal
            lot={cessionLot}
            attributaires={attributaireOptions}
            excludeAttributaireId={attrActuel?.attributaires?.id ?? null}
            nextRang={nextRang}
            tarifTier2={tarifTier2}
            tarifChefferie={tarifsChefferie.get(autoriteId)}
            isSubmitting={isSubmitting}
            onClose={() => setCessionLot(null)}
            onSubmit={handleCessionSubmit}
          />
        );
      })()}
    </div>
  );
}
