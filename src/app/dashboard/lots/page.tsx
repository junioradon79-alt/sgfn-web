"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle, ArrowRightLeft, Banknote, Boxes, Eye, FileWarning, Lock, Plus, Search, ShieldAlert,
} from "lucide-react";

import { AppShell } from "@/components/pilotage/AppShell";
import { Badge } from "@/components/ds/badge";
import { Button } from "@/components/ds/button";
import { Card } from "@/components/ds/card";
import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ds/dialog";
import { EmptyState } from "@/components/ds/empty-state";
import { Input, Textarea } from "@/components/ds/input";
import { Kpi } from "@/components/ds/kpi";
import { Field } from "@/components/ds/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ds/select";
import { BoutonImprimer } from "@/components/dashboard/BoutonImprimer";
import {
  Avertissement, CaseACocher, ChampSelect, ModaleFormulaire,
} from "@/components/dashboard/ModaleFormulaire";
import {
  LOT_STATUS_TONE, LotDetailModal, getBadgeConfig, lotPvAlert,
  type LitigeRow, type LotRecord, type PvInfo, type ScoreConfiance,
} from "@/components/dashboard/lots/LotDetailModal";
import { createClient } from "@/utils/supabase/client";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { useChargement } from "@/hooks/useChargement";
import { useProfile } from "@/hooks/useProfile";
import { fadeUp, stagger } from "@/lib/motion";
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

const STATUT_OPTIONS = [
  { value: "disponible", label: "Disponible" },
  { value: "attribue", label: "Attribué" },
  { value: "occupe", label: "Occupé" },
  { value: "vendu", label: "Vendu" },
  { value: "en_validation", label: "En validation" },
  { value: "en_litige", label: "Litige" },
  { value: "reserve_equipement", label: "Équipement" },
];

// Radix Select refuse la chaîne vide comme valeur d'option : il lui faut un
// jeton explicite pour « pas de filtre ».
const TOUS = "tous";

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
    <ModaleFormulaire
      surTitre="Transférer"
      titre={`Attribuer le Lot ${lot.numero_lot}`}
      onClose={onClose}
      onSubmit={handleSubmit}
      error={error}
      isSubmitting={isSubmitting}
      libelleAction="Confirmer l'attribution"
      libelleEnCours="Enregistrement…"
    >
      <ChampSelect id="attr-attributaire" label="Attributaire" required
        value={form.attributaire_id} onChange={(v) => setForm((f) => ({ ...f, attributaire_id: v }))}>
        {attributaires.map((a) => <SelectItem key={a.id} value={a.id}>{a.nom ?? "—"}</SelectItem>)}
      </ChampSelect>

      <ChampSelect id="attr-qualite" label="Qualité"
        value={form.qualite} onChange={(v) => setForm((f) => ({ ...f, qualite: v }))}>
        {QUALITE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </ChampSelect>

      <Field label="Date d'effet" htmlFor="attr-depuis">
        <Input id="attr-depuis" type="date" value={form.depuis}
          onChange={(e) => setForm((f) => ({ ...f, depuis: e.target.value }))} />
      </Field>

      <CaseACocher checked={form.actuel} onChange={(v) => setForm((f) => ({ ...f, actuel: v }))}>
        Attribution actuelle (met le lot en statut « Attribué »)
      </CaseACocher>

      <Field label="Observation" htmlFor="attr-obs">
        <Textarea id="attr-obs" value={form.observation} rows={2}
          onChange={(e) => setForm((f) => ({ ...f, observation: e.target.value }))}
          placeholder="Remarques, conditions…" />
      </Field>
    </ModaleFormulaire>
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
    <ModaleFormulaire
      surTitre="Nouveau dossier"
      surTitreTon="danger"
      titre={`Déclarer un litige — Lot ${lot.numero_lot}`}
      description={[
        lot.ilots?.lotissements?.nom,
        lot.ilots?.numero ? `Îlot ${lot.ilots.numero}` : null,
      ].filter(Boolean).join(" · ") || undefined}
      onClose={onClose}
      onSubmit={handleSubmit}
      error={error}
      isSubmitting={isSubmitting}
      variante="danger"
      libelleAction="Ouvrir le dossier"
      libelleEnCours="Ouverture…"
    >
      <Field label="Objet du litige" htmlFor="litige-objet" required>
        <Input id="litige-objet" type="text" value={form.objet} required
          onChange={(e) => setForm((f) => ({ ...f, objet: e.target.value }))}
          placeholder="Ex. Contestation de limites de parcelle" />
      </Field>

      <Field label="Notes" htmlFor="litige-notes">
        <Textarea id="litige-notes" value={form.notes} rows={3}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          placeholder="Contexte, parties impliquées, pièces jointes…" />
      </Field>

      <Avertissement>
        L&apos;ouverture d&apos;un dossier de litige est définitive et consignée dans le journal d&apos;audit.
      </Avertissement>
    </ModaleFormulaire>
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
    <ModaleFormulaire
      surTitre="Nouvelle cession"
      titre={`Lot ${lot.numero_lot} — ${nextRang}e attestation`}
      onClose={onClose}
      onSubmit={handleSubmit}
      error={error}
      isSubmitting={isSubmitting}
      actionDesactivee={!tarifDisponible}
      libelleAction="Créer la cession"
      libelleEnCours="Enregistrement…"
      entete={
        tarifDisponible ? (
          // `accent` et non `primary` : le primaire est un bleu marine sombre,
          // identique dans les deux thèmes par décision de la refonte — écrit
          // sur une surface sombre, il devient illisible. L'accent est le bleu
          // clair, précisément prévu pour porter du texte dans les deux thèmes.
          <div className="rounded-xl border border-accent/25 bg-accent-subtle p-4 text-sm text-accent">
            <p className="tabular font-semibold">{fcfa(montantTotal)} au total</p>
            <p className="tabular mt-0.5 text-xs opacity-80">
              {fcfa(partChefferie)} chefferie + {fcfa(commission)} commission SGNF
            </p>
          </div>
        ) : (
          <Avertissement>
            {isTier2
              ? "Tarif de la 2e attestation non configuré — contactez l'équipe SGNF."
              : "Tarif non défini pour la chefferie de ce lotissement (3e attestation et plus) — contactez l'équipe SGNF pour le fixer."}
          </Avertissement>
        )
      }
    >
      <ChampSelect id="cession-acquereur" label="Acquéreur" required
        value={form.acquereur_id} onChange={(v) => setForm((f) => ({ ...f, acquereur_id: v }))}>
        {candidats.map((a) => <SelectItem key={a.id} value={a.id}>{a.nom ?? "—"}</SelectItem>)}
      </ChampSelect>

      <Field label="Date de cession" htmlFor="cession-date">
        <Input id="cession-date" type="date" value={form.date_cession}
          onChange={(e) => setForm((f) => ({ ...f, date_cession: e.target.value }))} />
      </Field>

      <ChampSelect id="cession-moyen" label="Moyen de paiement"
        value={form.moyen} onChange={(v) => setForm((f) => ({ ...f, moyen: v as MoyenPaiement }))}>
        {MOYEN_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </ChampSelect>

      <Field label="Observation" htmlFor="cession-obs">
        <Textarea id="cession-obs" value={form.observation} rows={2}
          onChange={(e) => setForm((f) => ({ ...f, observation: e.target.value }))}
          placeholder="Remarques, conditions…" />
      </Field>
    </ModaleFormulaire>
  );
}

// ─── Génération exceptionnelle (admin) ─────────────────────────────────────────
// Chemin direct pour ce qui, jusqu'au 23/07, ne se faisait qu'en SQL manuel :
// débloquer une attestation malgré un dossier documentaire incomplet, lot par
// lot, sans passer par la dérogation du lotissement entier. La RPC
// `generer_attestation_exceptionnelle` fait le titulaire actuel gagnant quel
// que soit son rang (succession comme revente) et trace motif/auteur/date
// directement sur l'attestation — voir la migration du 23/07.

type ResultatGenerationExceptionnelle = {
  succes: number;
  echecs: { lot: string; message: string }[];
};

function GenerationExceptionnelleModal({ lots, onClose, onConfirm }: {
  lots: LotRecord[];
  onClose: () => void;
  onConfirm: (motif: string) => Promise<ResultatGenerationExceptionnelle>;
}) {
  const [motif, setMotif] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState<ResultatGenerationExceptionnelle | null>(null);
  const motifValide = motif.trim().length >= 10;

  const confirmer = async () => {
    if (!motifValide) return;
    setEnCours(true);
    const r = await onConfirm(motif.trim());
    setEnCours(false);
    setResultat(r);
  };

  return (
    <Dialog open onOpenChange={(ouvert) => { if (!ouvert && !enCours) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <p className="text-[11px] font-bold tracking-[0.18em] text-warning uppercase">Admin — hors chemin normal</p>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="size-5" aria-hidden />
            Génération exceptionnelle d&apos;attestation
          </DialogTitle>
          <DialogDescription>
            {lots.length} lot{lots.length > 1 ? "s" : ""} sélectionné{lots.length > 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {!resultat ? (
            <>
              <Avertissement>
                Génère directement l&apos;attestation du titulaire actuel de chaque lot — quel que soit son
                rang — sans passer par le score de confiance du lotissement ni par une cession payante.
                Réservez ceci aux dossiers dont la transaction réelle est déjà établie (succession, vente déjà
                actée) mais bloqués par un document manquant (PV, APFC…).
              </Avertissement>

              <div className="max-h-32 space-y-0.5 overflow-y-auto rounded-xl border border-border bg-inset p-3 text-xs text-muted-foreground">
                {lots.map((l) => (
                  <p key={l.id}>
                    Lot {l.numero_lot}
                    {l.ilots?.numero ? ` · Îlot ${l.ilots.numero}` : ""}
                    {l.ilots?.lotissements?.nom ? ` — ${l.ilots.lotissements.nom}` : ""}
                  </p>
                ))}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="motif-exception" className="text-sm font-medium text-foreground">
                  Motif de la génération exceptionnelle
                </label>
                <Textarea
                  id="motif-exception"
                  value={motif}
                  rows={3}
                  onChange={(e) => setMotif(e.target.value)}
                  placeholder="Ex. Attestations déjà mentionnées « délivrées » au guide de répartition ; dossier documentaire du lotissement incomplet (PV manquants)."
                />
                <p className="text-xs text-muted-2">
                  Conservé sur chaque attestation avec votre nom et l&apos;horodatage.{" "}
                  {motif.trim().length < 10 && `${10 - motif.trim().length} caractère(s) manquant(s).`}
                </p>
              </div>
            </>
          ) : (
            <div className="space-y-2 text-sm">
              {resultat.succes > 0 && (
                <p className="rounded-xl border border-success/25 bg-success-subtle px-4 py-2.5 text-success">
                  {resultat.succes} attestation{resultat.succes > 1 ? "s" : ""} générée{resultat.succes > 1 ? "s" : ""}.
                </p>
              )}
              {resultat.echecs.length > 0 && (
                <div className="rounded-xl border border-danger/25 bg-danger-subtle px-4 py-2.5 text-danger">
                  <p className="font-medium">{resultat.echecs.length} échec{resultat.echecs.length > 1 ? "s" : ""} :</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {resultat.echecs.map((e, i) => (
                      <li key={i}>{e.lot} — {e.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          {!resultat ? (
            <>
              <Button type="button" variant="outline" onClick={onClose} disabled={enCours}>Annuler</Button>
              <Button type="button" variant="primary" onClick={confirmer} disabled={!motifValide || enCours} loading={enCours}>
                Générer{lots.length > 1 ? ` (${lots.length})` : ""}
              </Button>
            </>
          ) : (
            <Button type="button" variant="primary" onClick={onClose}>Fermer</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const supabase = useMemo(() => createClient(), []);
  const { isAdmin, isChefferie, profile } = useProfile();
  const { counts } = useBadgeCounts();
  const canCreateCession = isAdmin || profile?.groupe === "operateur";

  const [lotRows, setLotRows] = useState<LotRecord[]>([]);
  const [ilotOptions, setIlotOptions] = useState<IlotOption[]>([]);
  const [attributaireOptions, setAttributaireOptions] = useState<AttributaireOption[]>([]);
  const [pvByCollectif, setPvByCollectif] = useState<Map<string, PvInfo>>(new Map());
  const [tarifTier2, setTarifTier2] = useState<TarifTier2 | null>(null);
  const [tarifsChefferie, setTarifsChefferie] = useState<Map<string, TarifChefferie>>(new Map());
  const [pvFilter, setPvFilter] = useState(false);
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState(TOUS);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detailLot, setDetailLot] = useState<LotRecord | null>(null);
  const [lotLitiges, setLotLitiges] = useState<LitigeRow[]>([]);
  const [scoreConfiance, setScoreConfiance] = useState<ScoreConfiance | null>(null);
  const [transfertLot, setTransfertLot] = useState<LotRecord | null>(null);
  const [litigeLot, setLitigeLot] = useState<LotRecord | null>(null);
  const [cessionLot, setCessionLot] = useState<LotRecord | null>(null);
  const [selectionException, setSelectionException] = useState<Set<string>>(new Set());
  const [modaleExceptionOuverte, setModaleExceptionOuverte] = useState(false);

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
          .select("lot_id, reference, statut, cession_id, exception, exception_le")
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
  }, [supabase]);

  // Chargement du dossier quand une fiche s'ouvre. La remise à zéro se fait à
  // l'ouverture (`ouvrirDossier`), pas ici : un `setState` dans la branche
  // « pas de lot sélectionné » violerait `react-hooks/set-state-in-effect`.
  useEffect(() => {
    if (!detailLot) return;
    supabase
      .from("litiges")
      .select("id, objet, statut, ouvert_le")
      .eq("lot_id", detailLot.id)
      .then(({ data }) => setLotLitiges((data ?? []) as LitigeRow[]));
    supabase
      .rpc("calculer_score_confiance", { p_lot_id: detailLot.id })
      .then(({ data }) => setScoreConfiance((data ?? null) as ScoreConfiance | null));
  }, [detailLot, supabase]);

  const ouvrirDossier = (lot: LotRecord) => {
    setLotLitiges([]);
    setScoreConfiance(null);
    setDetailLot(lot);
  };

  const handleCreateSubmit = async (e: FormEvent) => {
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

  const basculerSelectionException = (lotId: string) => {
    setSelectionException((s) => {
      const next = new Set(s);
      if (next.has(lotId)) next.delete(lotId); else next.add(lotId);
      return next;
    });
  };

  const genererExceptionnellement = async (motif: string) => {
    const lots = scopedRows.filter((l) => selectionException.has(l.id));
    const echecs: { lot: string; message: string }[] = [];
    let succes = 0;
    for (const lot of lots) {
      const { error } = await supabase.rpc("generer_attestation_exceptionnelle", {
        p_lot_id: lot.id,
        p_motif: motif,
      });
      if (error) echecs.push({ lot: `Lot ${lot.numero_lot}`, message: error.message });
      else succes += 1;
    }
    if (succes > 0) {
      setSelectionException(new Set());
      await recharger();
    }
    return { succes, echecs };
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
    .filter((l) => statutFilter === TOUS || (l.statut ?? "disponible") === statutFilter);

  const vueFiltree = statutFilter !== TOUS || pvFilter || Boolean(search);

  return (
    <AppShell loading={isLoading} counts={counts} onRefresh={recharger}>
      {/* Titre de l'écran — l'en-tête du shell porte la salutation, pas le
          contexte métier : c'est la page qui dit où l'on est et pourquoi. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">
            Registre foncier
          </h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            Suivi, traçabilité et statut juridique des parcelles cadastrales enregistrées.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <BoutonImprimer />
          {!isChefferie && (
            <Button
              type="button"
              variant="primary"
              className="print:hidden"
              onClick={() => { setIsModalOpen(true); setErrorMessage(null); setSuccessMessage(null); }}
            >
              <Plus />
              Ajouter un lot
            </Button>
          )}
        </div>
      </div>

      <motion.section
        variants={stagger(0, 0.05)}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        aria-label="Indicateurs du registre"
      >
        <Kpi
          icon={Boxes}
          label="Lots au registre"
          loading={isLoading}
          value={scopedRows.length}
          legende={<>dans votre périmètre</>}
        />
        <Kpi
          icon={Search}
          label="Lots affichés"
          loading={isLoading}
          value={displayedRows.length}
          legende={vueFiltree ? <>vue filtrée</> : <>vue complète, sans filtre</>}
        />
        <Kpi
          icon={FileWarning}
          label="PV à régulariser"
          loading={isLoading}
          value={pvAlertCount}
          tone={pvAlertCount > 0 ? "warning" : "neutral"}
          legende={<>transmissions depuis un collectif</>}
        />
      </motion.section>

      {successMessage && (
        <p role="status" className="rounded-xl border border-success/25 bg-success-subtle px-4 py-3 text-sm font-medium text-success">
          {successMessage}
        </p>
      )}

      <motion.div variants={stagger(0.05, 0.06)} initial="hidden" animate="show" className="flex flex-col gap-5">
        {/* Barre de recherche */}
        <motion.div variants={fadeUp}>
          <Card className="flex-row flex-wrap items-center gap-3 p-3 print:hidden">
            <div className="relative min-w-0 flex-1 sm:max-w-md">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                type="search"
                placeholder="Rechercher un lot, un attributaire…"
                className="pl-9"
                aria-label="Rechercher un lot"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statutFilter} onValueChange={setStatutFilter}>
              <SelectTrigger className="w-full sm:w-52" aria-label="Filtrer par statut">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TOUS}>Tous les statuts</SelectItem>
                {STATUT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Card>
        </motion.div>

        {/* Bandeau d'alerte PV de réunion de famille */}
        {pvAlertCount > 0 && (
          <motion.button
            variants={fadeUp}
            type="button"
            onClick={() => setPvFilter((v) => !v)}
            aria-pressed={pvFilter}
            className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors print:hidden ${
              pvFilter
                ? "border-warning/40 bg-warning-subtle text-warning"
                : "border-warning/25 bg-warning-subtle/60 text-warning hover:bg-warning-subtle"
            }`}
          >
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            <span>
              <span className="font-semibold">{pvAlertCount} lot{pvAlertCount > 1 ? "s" : ""}</span>{" "}
              en attente d&apos;un PV de réunion de famille (transmission par un collectif d&apos;ayants-droit).
            </span>
            <span className="ml-auto shrink-0 font-semibold underline">
              {pvFilter ? "Tout afficher" : "Voir"}
            </span>
          </motion.button>
        )}

        {/* Barre de sélection — génération exceptionnelle (admin) */}
        {isAdmin && selectionException.size > 0 && (
          <motion.div
            variants={fadeUp}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/30 bg-warning-subtle px-4 py-3 text-sm text-warning print:hidden"
          >
            <ShieldAlert className="size-4 shrink-0" aria-hidden />
            <span className="font-semibold">
              {selectionException.size} lot{selectionException.size > 1 ? "s" : ""} sélectionné{selectionException.size > 1 ? "s" : ""}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => setSelectionException(new Set())}
            >
              Désélectionner tout
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setModaleExceptionOuverte(true)}
            >
              <ShieldAlert className="size-4" />
              Génération exceptionnelle
            </Button>
          </motion.div>
        )}

        {/* Tableau */}
        <motion.div variants={fadeUp}>
          <Card className="overflow-hidden print:border-none print:shadow-none">
            {isLoading ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">Chargement des lots…</p>
            ) : displayedRows.length === 0 ? (
              <EmptyState
                icon={Boxes}
                title={vueFiltree ? "Aucun lot ne correspond" : "Aucun lot enregistré"}
                description={
                  vueFiltree
                    ? "Aucune parcelle du registre ne répond à ces critères. Élargissez la recherche ou le filtre de statut."
                    : "Le registre de votre périmètre est vide."
                }
              />
            ) : (
              // Défilement interne plutôt qu'une page à rallonge : le registre
              // compte ~900 lots, soit près de 50 000 px de haut si on laisse la
              // table s'étirer — tout ce qui suit devient inatteignable. En
              // `overflow-auto` natif (pas `ScrollArea`) parce que cet écran
              // s'imprime : les surcharges `print:` doivent pouvoir rendre la
              // hauteur au navigateur.
              <div className="max-h-[62vh] overflow-auto print:max-h-none print:overflow-visible">
                <table className="w-full min-w-[860px] border-collapse text-left">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-border bg-inset">
                      {isAdmin && (
                        <th scope="col" className="bg-inset px-5 py-3 print:hidden">
                          <input
                            type="checkbox"
                            aria-label="Sélectionner tous les lots affichés"
                            className="size-4 rounded border-border"
                            style={{ accentColor: "var(--primary)" }}
                            checked={displayedRows.length > 0 && displayedRows.every((l) => selectionException.has(l.id))}
                            onChange={() => {
                              const idsVisibles = displayedRows.map((l) => l.id);
                              const touslà = idsVisibles.every((id) => selectionException.has(id));
                              setSelectionException(touslà ? new Set() : new Set(idsVisibles));
                            }}
                          />
                        </th>
                      )}
                      {TABLE_HEADERS.map((header) => (
                        <th
                          key={header}
                          scope="col"
                          className="bg-inset px-5 py-3 text-[10.5px] font-bold tracking-wider text-muted-foreground uppercase last:text-right print:last:hidden"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {displayedRows.map((lot) => {
                      const badge = getBadgeConfig(lot);
                      const lotissementNom = lot.ilots?.lotissements?.nom;
                      const commune = lot.ilots?.lotissements?.commune;
                      const ilotNum = lot.ilots?.numero;
                      const attrActuel = lot.attributions?.find((a) => a.actuel) ?? lot.attributions?.[0];

                      return (
                        <tr key={lot.id} className="transition-colors hover:bg-inset/70">
                          {isAdmin && (
                            <td className="px-5 py-3.5 print:hidden">
                              <input
                                type="checkbox"
                                aria-label={`Sélectionner le lot ${lot.numero_lot}`}
                                className="size-4 rounded border-border"
                                style={{ accentColor: "var(--primary)" }}
                                checked={selectionException.has(lot.id)}
                                onChange={() => basculerSelectionException(lot.id)}
                              />
                            </td>
                          )}
                          {/* Lot */}
                          <td className="px-5 py-3.5">
                            <p className="text-[13px] font-bold text-foreground">Lot {lot.numero_lot}</p>
                            {lot.numero_parcelle && <p className="mt-0.5 text-xs text-muted-2">Parc. {lot.numero_parcelle}</p>}
                            {lot.verrouille && (
                              <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-warning">
                                <Lock className="size-3" aria-hidden />Gelé
                              </span>
                            )}
                          </td>

                          {/* Lotissement & localité */}
                          <td className="px-5 py-3.5">
                            <p className="text-[13px] font-medium text-foreground">{lotissementNom ?? "—"}</p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2">
                              {ilotNum && (
                                <span className="inline-flex items-center rounded-md bg-accent-subtle px-1.5 py-0.5 text-xs font-semibold text-accent">
                                  Îlot {ilotNum}
                                </span>
                              )}
                              {commune && <span className="text-xs text-muted-2">{commune}</span>}
                            </div>
                          </td>

                          {/* Attributaire */}
                          <td className="px-5 py-3.5 text-[13px] text-muted-foreground">
                            {attrActuel?.attributaires?.nom ?? (
                              badge.status === "attribue" ? (
                                <span className="text-muted-2 italic" title="Le détail de l'attribution est réservé à certains rôles (admin, chefferie, opérateur, vérificateur, commissaire…).">
                                  Non visible pour votre rôle
                                </span>
                              ) : (
                                <span className="text-muted-2">Non attribué</span>
                              )
                            )}
                          </td>

                          {/* Statut */}
                          <td className="px-5 py-3.5">
                            <Badge tone={LOT_STATUS_TONE[badge.status]}>{badge.label}</Badge>
                            {lotPvAlert(lot, pvByCollectif) && (
                              <span className="mt-1 flex items-center gap-1 text-xs font-medium text-warning">
                                <AlertTriangle className="size-3" aria-hidden />PV à régulariser
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-3.5 text-right print:hidden">
                            <div className="inline-flex items-center gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => ouvrirDossier(lot)}
                                title="Voir le dossier"
                                aria-label={`Voir le dossier du lot ${lot.numero_lot}`}
                              >
                                <Eye />
                              </Button>
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => setTransfertLot(lot)}
                                  title="Transférer / Attribuer"
                                  aria-label={`Transférer le lot ${lot.numero_lot}`}
                                >
                                  <ArrowRightLeft />
                                </Button>
                              )}
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="hover:bg-danger-subtle hover:text-danger"
                                  onClick={() => setLitigeLot(lot)}
                                  title="Déclarer un litige"
                                  aria-label={`Déclarer un litige sur le lot ${lot.numero_lot}`}
                                >
                                  <AlertTriangle />
                                </Button>
                              )}
                              {canCreateCession && attrActuel && (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="hover:bg-success-subtle hover:text-success"
                                  onClick={() => setCessionLot(lot)}
                                  title="Créer une cession"
                                  aria-label={`Créer une cession sur le lot ${lot.numero_lot}`}
                                >
                                  <Banknote />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </motion.div>
      </motion.div>

      {/* Modal création lot */}
      {isModalOpen && (
        <ModaleFormulaire
          surTitre="Nouveau lot"
          titre="Créer une parcelle foncière"
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleCreateSubmit}
          error={errorMessage}
          isSubmitting={isSubmitting}
          libelleAction="Enregistrer la parcelle"
          libelleEnCours="Enregistrement…"
        >
          <Field label="Numéro de lot" htmlFor="lot-numero" required>
            <Input id="lot-numero" type="text" value={formState.numero_lot} required
              onChange={(e) => setFormState((f) => ({ ...f, numero_lot: e.target.value }))}
              placeholder="Ex. 042" />
          </Field>

          <ChampSelect id="lot-ilot" label="Îlot de rattachement" required
            value={formState.ilot_id} onChange={(v) => setFormState((f) => ({ ...f, ilot_id: v }))}>
            {Object.entries(ilotGroups).map(([lotNom, ilots]) => (
              <SelectGroupeLotissement key={lotNom} nom={lotNom} ilots={ilots} />
            ))}
          </ChampSelect>

          <CaseACocher
            checked={formState.est_equipement}
            onChange={(v) => setFormState((f) => ({ ...f, est_equipement: v }))}
          >
            Réservé à un équipement public
          </CaseACocher>
        </ModaleFormulaire>
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

      {modaleExceptionOuverte && (
        <GenerationExceptionnelleModal
          lots={scopedRows.filter((l) => selectionException.has(l.id))}
          onClose={() => setModaleExceptionOuverte(false)}
          onConfirm={genererExceptionnellement}
        />
      )}
    </AppShell>
  );
}

/**
 * Radix Select n'a pas d'`optgroup` : on rend le nom du lotissement comme
 * intertitre non sélectionnable, au-dessus de ses îlots.
 */
function SelectGroupeLotissement({ nom, ilots }: { nom: string; ilots: IlotOption[] }) {
  return (
    <>
      <p className="px-2 pt-2 pb-1 text-[10.5px] font-bold tracking-wider text-muted-2 uppercase">{nom}</p>
      {ilots.map((ilot) => (
        <SelectItem key={ilot.id} value={ilot.id}>
          Îlot {ilot.numero} {ilot.lotissements?.commune ? `— ${ilot.lotissements.commune}` : ""}
        </SelectItem>
      ))}
    </>
  );
}
