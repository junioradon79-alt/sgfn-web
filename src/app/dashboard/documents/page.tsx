"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Download,
  FileCheck,
  FileSignature,
  FileText,
  ExternalLink,
  Hash,
  QrCode,
  Copy,
  Check,
  CheckCircle2,
  Upload,
  Image as ImageIcon,
  Loader2 as LoaderIcon,
  Sparkles,
  PackageCheck,
  Ban,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { AppShell } from "@/components/pilotage/AppShell";
import { Badge } from "@/components/ds/badge";
import { Button } from "@/components/ds/button";
import { Card } from "@/components/ds/card";
import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ds/dialog";
import { Kpi } from "@/components/ds/kpi";
import { BoutonImprimer } from "@/components/dashboard/BoutonImprimer";
import UploadPlanModal from "@/components/dashboard/UploadPlanModal";
import { createClient } from "@/utils/supabase/client";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { useChargement } from "@/hooks/useChargement";
import { useProfile } from "@/hooks/useProfile";
import { fadeUp, stagger } from "@/lib/motion";
import {
  SIGNATURES_ATTESTATION as SIGNATURES,
  SIGNATURES_PAR_DEFAUT,
  libelleSignature,
} from "@/lib/signatures-attestation";

// ─── Types ────────────────────────────────────────────────────────────────────

type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

type AttestationRow = {
  id: string;
  reference: string;
  statut: string;
  date_emission: string | null;
  cree_le: string;
  sig_proprietaire_le: string | null;
  sig_operateur_le: string | null;
  sig_chefferie_le: string | null;
  qr_token: string | null;
  lots: {
    numero_lot: string | null;
    ilots: {
      numero: string | null;
      /** `signatures_requises` varie par lotissement — Koelea-Accor revu n'en
       *  exige que 2 (sans l'opérateur), la norme est à 3. */
      lotissements: {
        nom: string | null;
        signatures_requises: string[] | null;
        famille_id: string | null;
      } | null;
    } | null;
  } | null;
  attributaires: { nom: string | null } | null;
};


type PvRow = {
  id: string;
  reference: string;
  objet: string;
  statut: string;
  date_reunion: string | null;
  valide_le: string | null;
  lieu: string | null;
  document_id: string | null;
  document: { url_fichier: string | null } | null;
  attributaires: { nom: string | null } | null;
};

type DocumentRow = {
  id: string;
  type: string;
  titre: string | null;
  emetteur: string | null;
  date_document: string | null;
  url_fichier: string;
  apercu_url: string | null;
  hash_fichier: string | null;
  televerse_le: string;
  lots: { numero_lot: string | null; ilots: { lotissements: { nom: string | null } | null } | null } | null;
};

type DlState = Record<string, "idle" | "loading" | "error">;

// ─── Constantes ───────────────────────────────────────────────────────────────

const ATT_STATUT_TONE: Record<string, BadgeTone> = {
  a_generer: "warning",
  generee: "accent",
  delivree: "success",
  revoquee: "danger",
};
const ATT_STATUT_LABEL: Record<string, string> = {
  a_generer: "À générer",
  generee: "Générée",
  delivree: "Délivrée",
  revoquee: "Révoquée",
};

const PV_STATUT_TONE: Record<string, BadgeTone> = {
  a_fournir: "warning",
  fourni: "accent",
  valide: "success",
  rejete: "danger",
};
const PV_STATUT_LABEL: Record<string, string> = {
  a_fournir: "À fournir",
  fourni: "Fourni",
  valide: "Validé",
  rejete: "Rejeté",
};

const DOC_TYPE_LABEL: Record<string, string> = {
  apfc: "APFC",
  attestation_cession: "Attestation de cession",
  plan_lotissement: "Plan de lotissement",
  plan_lot: "Plan de lot",
  piece_identite: "Pièce d'identité",
  acte_vente: "Acte de vente",
  quittance: "Quittance",
  acd: "ACD",
  titre_foncier: "Titre foncier",
  certificat_propriete_coutumiere: "Cert. propriété coutumière",
  pv_constatation: "PV de constatation",
  attestation_non_contestation: "Attestation non-contestation",
  plan_localisation: "Plan de localisation",
  autre: "Autre",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const TH_CLASS = "bg-inset px-5 py-3 text-left text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground";

// ─── Indicateur de signature ──────────────────────────────────────────────────

/**
 * Signatures **constatées** : le document est signé sur papier, on enregistre
 * seulement qu'elles y figurent (et qui l'a constaté). La signature
 * électronique reste hors scope — voir la migration du 22/07.
 *
 * Le dénominateur suit le lotissement : `n/2` sur Koelea-Accor revu, `n/3`
 * ailleurs. Une signature non requise s'affiche en creux et non en « manquante »,
 * sans quoi Koelea-Accor semblerait éternellement incomplet.
 */
function SigDots({
  att,
  onSigner,
  enCours,
}: {
  att: AttestationRow;
  onSigner?: (att: AttestationRow, signature: string) => void;
  enCours?: string | null;
}) {
  const lotissement = att.lots?.ilots?.lotissements;
  const requises = lotissement?.signatures_requises ?? SIGNATURES_PAR_DEFAUT;
  const uneSeuleFamille = Boolean(lotissement?.famille_id);
  const dateDe: Record<string, string | null> = {
    proprietaire: att.sig_proprietaire_le,
    operateur: att.sig_operateur_le,
    chefferie: att.sig_chefferie_le,
  };
  const signeesRequises = requises.filter((c) => dateDe[c]).length;
  const revoquee = att.statut === "revoquee";

  return (
    <div className="flex items-center gap-1.5">
      {SIGNATURES.map((s) => {
        const requise = requises.includes(s.cle);
        const date = dateDe[s.cle];
        const label = libelleSignature(s.cle, uneSeuleFamille);
        const cliquable = Boolean(onSigner) && requise && !date && !revoquee;
        const titre = !requise
          ? `${label} — non requise pour ce lotissement`
          : date
            ? `${label} — constatée le ${fmtDate(date)}`
            : cliquable
              ? `${label} — cliquer pour constater la signature sur le document papier`
              : `${label} — non signée`;
        const pastille = (
          <span
            title={titre}
            className={`block h-2.5 w-2.5 rounded-full ${
              !requise
                ? "border border-dashed border-border bg-transparent"
                : date
                  ? "bg-success"
                  : "bg-border"
            }`}
          />
        );
        return cliquable ? (
          <button
            key={s.cle}
            type="button"
            onClick={() => onSigner?.(att, s.cle)}
            disabled={enCours === `${att.id}:${s.cle}`}
            aria-label={titre}
            className="rounded-full p-0.5 transition hover:bg-inset disabled:opacity-50"
          >
            {pastille}
          </button>
        ) : (
          <span key={s.cle} className="p-0.5">
            {pastille}
          </span>
        );
      })}
      <span className="ml-1 text-xs text-muted-2">
        {signeesRequises}/{requises.length}
      </span>
    </div>
  );
}

// ─── Onglet Attestations ──────────────────────────────────────────────────────

function AttestationsTab({ rows, dlState, remiseState, onDownload, onShowQr, onMarquerDelivree, onRevoquer, onSigner, signatureEnCours, erreurAction }: {
  rows: AttestationRow[];
  dlState: DlState;
  remiseState: DlState;
  onDownload: (ref: string) => void;
  onShowQr: (att: AttestationRow) => void;
  onMarquerDelivree: (id: string) => void;
  /** Réservé à l'admin — absent pour les autres rôles. */
  onRevoquer?: (att: AttestationRow) => void;
  /** Constater une signature — admin, opérateur, et chefferie pour la sienne. */
  onSigner?: (att: AttestationRow, signature: string) => void;
  signatureEnCours?: string | null;
  erreurAction?: string | null;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-sm text-muted-foreground">
        <FileCheck className="mb-3 h-8 w-8 text-muted-2" />
        Aucune attestation enregistrée.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      {erreurAction && (
        <p className="mx-5 mb-3 rounded-xl border border-danger/30 bg-danger/5 px-4 py-2.5 text-sm text-danger">
          {erreurAction}
        </p>
      )}
      <table className="w-full min-w-[800px] text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className={TH_CLASS}>Référence</th>
            <th className={TH_CLASS}>Lot</th>
            <th className={TH_CLASS}>Acquéreur</th>
            <th className={TH_CLASS}>Statut</th>
            <th className={TH_CLASS}>Signatures</th>
            <th className={TH_CLASS}>Date émission</th>
            <th className={TH_CLASS}></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((att) => {
            const lot = att.lots;
            const lotLabel = lot
              ? `Lot ${lot.numero_lot ?? "—"}${lot.ilots?.numero ? ` · Îlot ${lot.ilots.numero}` : ""}`
              : "—";
            const lotissement = lot?.ilots?.lotissements?.nom ?? null;
            const dl = dlState[att.reference] ?? "idle";
            const remise = remiseState[att.id] ?? "idle";
            return (
              <tr key={att.id} className="transition hover:bg-inset/60">
                <td className="px-5 py-3.5 font-mono text-xs font-semibold text-accent">
                  {att.reference}
                </td>
                <td className="px-5 py-3.5 text-foreground">
                  {lotLabel}
                  {lotissement && <p className="text-xs text-muted-2">{lotissement}</p>}
                </td>
                <td className="px-5 py-3.5 text-muted-foreground">
                  {att.attributaires?.nom ?? "—"}
                </td>
                <td className="px-5 py-3.5">
                  <Badge tone={ATT_STATUT_TONE[att.statut] ?? "warning"}>
                    {ATT_STATUT_LABEL[att.statut] ?? att.statut}
                  </Badge>
                </td>
                <td className="px-5 py-3.5">
                  <SigDots att={att} onSigner={onSigner} enCours={signatureEnCours} />
                </td>
                <td className="px-5 py-3.5 text-muted-2">
                  {fmtDate(att.date_emission ?? att.cree_le)}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {att.statut === "generee" && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onMarquerDelivree(att.id)}
                        disabled={remise === "loading"}
                        title="Marquer comme délivrée (remise physique au bénéficiaire)"
                        aria-label="Marquer comme délivrée"
                        className={remise === "error" ? "text-danger" : "hover:text-success"}
                      >
                        <PackageCheck className={remise === "loading" ? "animate-pulse" : ""} />
                      </Button>
                    )}
                    {onRevoquer && (att.statut === "generee" || att.statut === "delivree") && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onRevoquer(att)}
                        title="Révoquer cette attestation (elle deviendra INVALIDE à la vérification publique)"
                        aria-label="Révoquer cette attestation"
                        className="hover:text-danger"
                      >
                        <Ban />
                      </Button>
                    )}
                    {att.qr_token && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onShowQr(att)}
                        title="QR code de vérification"
                        aria-label="QR code de vérification"
                      >
                        <QrCode />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onDownload(att.reference)}
                      disabled={dl === "loading"}
                      title="Télécharger"
                      aria-label="Télécharger"
                      className={dl === "error" ? "text-danger" : undefined}
                    >
                      <Download className={dl === "loading" ? "animate-pulse" : ""} />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Onglet PV de famille ─────────────────────────────────────────────────────

function PvTab({ rows }: { rows: PvRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-sm text-muted-foreground">
        <FileSignature className="mb-3 h-8 w-8 text-muted-2" />
        Aucun PV de famille enregistré.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className={TH_CLASS}>Référence</th>
            <th className={TH_CLASS}>Objet</th>
            <th className={TH_CLASS}>Collectif</th>
            <th className={TH_CLASS}>Statut</th>
            <th className={TH_CLASS}>Date réunion</th>
            <th className={TH_CLASS}>Validé le</th>
            <th className={TH_CLASS}></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((pv) => {
            const fileUrl = pv.document?.url_fichier ?? null;
            return (
              <tr key={pv.id} className="transition hover:bg-inset/60">
                <td className="px-5 py-3.5 font-mono text-xs font-semibold text-accent">
                  {pv.reference}
                </td>
                <td className="px-5 py-3.5 text-foreground">
                  <p className="max-w-[260px] truncate">{pv.objet}</p>
                  {pv.lieu && <p className="text-xs text-muted-2">{pv.lieu}</p>}
                </td>
                <td className="px-5 py-3.5 text-muted-foreground">
                  {pv.attributaires?.nom ?? "—"}
                </td>
                <td className="px-5 py-3.5">
                  <Badge tone={PV_STATUT_TONE[pv.statut] ?? "warning"}>
                    {PV_STATUT_LABEL[pv.statut] ?? pv.statut}
                  </Badge>
                </td>
                <td className="px-5 py-3.5 text-muted-2">{fmtDate(pv.date_reunion)}</td>
                <td className="px-5 py-3.5 text-muted-2">{fmtDate(pv.valide_le)}</td>
                <td className="px-5 py-3.5 text-right">
                  {fileUrl ? (
                    <Button asChild variant="ghost" size="icon-sm" title="Ouvrir le document">
                      <a href={fileUrl} target="_blank" rel="noopener noreferrer" aria-label="Ouvrir le document">
                        <ExternalLink />
                      </a>
                    </Button>
                  ) : (
                    <span className="text-muted-2">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Onglet Documents génériques ──────────────────────────────────────────────

function PlanApercu({ doc, apercuUrl, onOpenLightbox }: {
  doc: DocumentRow;
  apercuUrl: string | undefined;
  onOpenLightbox: (url: string) => void;
}) {
  if (!doc.apercu_url) {
    return (
      <Badge tone="warning">
        <ImageIcon /> Conversion en cours
      </Badge>
    );
  }
  if (!apercuUrl) {
    return <LoaderIcon className="h-4 w-4 animate-spin text-muted-2" />;
  }
  return (
    <button type="button" onClick={() => onOpenLightbox(apercuUrl)} className="block h-12 w-16 overflow-hidden rounded-lg border border-border">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={apercuUrl} alt="Aperçu du plan" className="h-full w-full object-cover" />
    </button>
  );
}

function DocumentsTab({ rows, apercuUrls, dlOriginal, onOpenLightbox }: {
  rows: DocumentRow[];
  apercuUrls: Record<string, string>;
  dlOriginal: (id: string) => void;
  onOpenLightbox: (url: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-sm text-muted-foreground">
        <FileText className="mb-3 h-8 w-8 text-muted-2" />
        Aucun document téléversé.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className={TH_CLASS}>Type</th>
            <th className={TH_CLASS}>Titre</th>
            <th className={TH_CLASS}>Aperçu</th>
            <th className={TH_CLASS}>Lot associé</th>
            <th className={TH_CLASS}>Date document</th>
            <th className={TH_CLASS}>Intégrité</th>
            <th className={TH_CLASS}></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((doc) => {
            const lot = doc.lots;
            const lotLabel = lot ? `Lot ${lot.numero_lot ?? "—"}` : null;
            const lotissement = lot?.ilots?.lotissements?.nom ?? null;
            const estPlan = doc.type === "plan_lot" || doc.type === "plan_lotissement";
            return (
              <tr key={doc.id} className="transition hover:bg-inset/60">
                <td className="px-5 py-3.5">
                  <Badge tone="neutral">{DOC_TYPE_LABEL[doc.type] ?? doc.type}</Badge>
                </td>
                <td className="px-5 py-3.5 text-foreground">
                  {doc.titre ?? <span className="text-muted-2">Sans titre</span>}
                </td>
                <td className="px-5 py-3.5">
                  {estPlan ? (
                    <PlanApercu doc={doc} apercuUrl={apercuUrls[doc.id]} onOpenLightbox={onOpenLightbox} />
                  ) : (
                    <span className="text-muted-2">—</span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-muted-foreground">
                  {lotLabel ? (
                    <>
                      {lotLabel}
                      {lotissement && <p className="text-xs text-muted-2">{lotissement}</p>}
                    </>
                  ) : (
                    <span className="text-muted-2">—</span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-muted-2">
                  {fmtDate(doc.date_document ?? doc.televerse_le)}
                </td>
                <td className="px-5 py-3.5">
                  {doc.hash_fichier ? (
                    <span title={doc.hash_fichier} className="flex items-center gap-1 text-xs text-success">
                      <Hash className="h-3 w-3" />
                      Hashé
                    </span>
                  ) : (
                    <span className="text-xs text-muted-2">—</span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-right">
                  {estPlan ? (
                    <Button variant="ghost" size="icon-sm" onClick={() => dlOriginal(doc.id)} title="Télécharger l'original" aria-label="Télécharger l'original">
                      <Download />
                    </Button>
                  ) : (
                    <Button asChild variant="ghost" size="icon-sm" title="Ouvrir">
                      <a href={doc.url_fichier} target="_blank" rel="noopener noreferrer" aria-label="Ouvrir">
                        <ExternalLink />
                      </a>
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Modale QR code ───────────────────────────────────────────────────────────

function QrModal({ att, onClose }: { att: AttestationRow; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const urlVerification = `${window.location.origin}/verifier/?ref=${att.qr_token}`;

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(urlVerification);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard indisponible */ }
  };

  return (
    <Dialog open onOpenChange={(ouvert) => { if (!ouvert) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>QR code de vérification</DialogTitle>
          <DialogDescription className="font-mono">{att.reference}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4 text-center">
          <div className="flex justify-center rounded-xl border border-border bg-white p-5">
            <QRCodeSVG value={urlVerification} size={220} level="M" includeMargin={false} />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Ce QR code figure sur le document imprimé. Tout scan mène à la page
            publique de vérification SGNF et est journalisé côté serveur.
          </p>
          <Button type="button" variant="primary" className="w-full" onClick={copier}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Lien copié" : "Copier le lien de vérification"}
          </Button>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modale de révocation ─────────────────────────────────────────────────────

/**
 * Révoquer est un acte qui engage : le document devient INVALIDE pour toute
 * vérification publique, et aucune RPC ne permet de revenir en arrière. D'où le
 * motif obligatoire (10 caractères minimum, contrôlé aussi côté serveur) et
 * l'énoncé explicite de la conséquence avant confirmation.
 */
function RevocationModal({ att, onClose, onConfirm }: {
  att: AttestationRow;
  onClose: () => void;
  onConfirm: (motif: string) => Promise<string | null>;
}) {
  const [motif, setMotif] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const motifValide = motif.trim().length >= 10;

  const confirmer = async () => {
    if (!motifValide) return;
    setEnCours(true);
    setErreur(null);
    const message = await onConfirm(motif.trim());
    setEnCours(false);
    if (message) setErreur(message);
    else onClose();
  };

  return (
    <Dialog open onOpenChange={(ouvert) => { if (!ouvert && !enCours) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Révoquer cette attestation</DialogTitle>
          <DialogDescription className="font-mono">{att.reference}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <p className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-foreground">
            Après révocation, toute vérification publique de ce document — QR compris — affichera
            <strong> « Document révoqué — ne pas s&apos;y fier »</strong>. L&apos;opération n&apos;est
            pas réversible : corriger passe par l&apos;émission d&apos;une nouvelle attestation.
          </p>

          <div className="space-y-1.5">
            <label htmlFor="motif-revocation" className="text-sm font-medium text-foreground">
              Motif de la révocation
            </label>
            <textarea
              id="motif-revocation"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              rows={3}
              placeholder="Ex. Erreur d'attributaire — le lot 042 avait déjà été cédé le 12/03."
              className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
            />
            <p className="text-xs text-muted-2">
              Conservé au registre et jamais montré au public : il peut nommer une fraude ou une
              personne. {motif.trim().length < 10 && `${10 - motif.trim().length} caractère(s) manquant(s).`}
            </p>
          </div>

          {erreur && (
            <p className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-2.5 text-sm text-danger">
              {erreur}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={enCours}>
              Annuler
            </Button>
            <Button type="button" variant="danger" onClick={confirmer} disabled={!motifValide || enCours}>
              {enCours && <LoaderIcon className="h-4 w-4 animate-spin" />}
              Révoquer définitivement
            </Button>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

type Tab = "attestations" | "pv" | "documents";

export default function DocumentsPage() {
  const supabase = useMemo(() => createClient(), []);
  const { profile, isAdmin } = useProfile();
  const { counts } = useBadgeCounts();
  const [activeTab, setActiveTab] = useState<Tab>("attestations");
  const [attestations, setAttestations] = useState<AttestationRow[]>([]);
  const [pvs, setPvs] = useState<PvRow[]>([]);
  const [docs, setDocs] = useState<DocumentRow[]>([]);

  const [dlState, setDlState] = useState<DlState>({});
  const [remiseState, setRemiseState] = useState<DlState>({});
  const [aRevoquer, setARevoquer] = useState<AttestationRow | null>(null);
  const [signatureEnCours, setSignatureEnCours] = useState<string | null>(null);
  const [erreurAction, setErreurAction] = useState<string | null>(null);
  const [qrAtt, setQrAtt] = useState<AttestationRow | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [apercuUrls, setApercuUrls] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [attestationsEligibles, setAttestationsEligibles] = useState(0);
  const [genererEnCours, setGenererEnCours] = useState(false);
  const [genererErreur, setGenererErreur] = useState<string | null>(null);

  const peutTeleverserPlan = isAdmin || profile?.groupe === "geometre";

  const load = useCallback(async () => {
    const [attRes, pvRes, docRes, eligiblesRes] = await Promise.all([
      supabase
        .from("attestations_cession")
        .select(
          "id, reference, statut, date_emission, cree_le, sig_proprietaire_le, sig_operateur_le, sig_chefferie_le, qr_token, lots(numero_lot, ilots(numero, lotissements(nom, signatures_requises, famille_id))), attributaires(nom)"
        )
        .order("cree_le", { ascending: false }),
      supabase
        .from("pv_reunions_famille")
        .select(
          "id, reference, objet, statut, date_reunion, valide_le, lieu, document_id, document:documents!document_id(url_fichier), attributaires:attributaires!pv_reunions_famille_collectif_attributaire_id_fkey(nom)"
        )
        .order("cree_le", { ascending: false }),
      supabase
        .from("documents")
        .select(
          "id, type, titre, emetteur, date_document, url_fichier, apercu_url, hash_fichier, televerse_le, lots(numero_lot, ilots(lotissements(nom)))"
        )
        .order("televerse_le", { ascending: false }),
      supabase.from("v_attestations_gratuites_manquantes").select("lot_id", { count: "exact", head: true }),
    ]);
    setAttestations((attRes.data ?? []) as unknown as AttestationRow[]);
    setPvs((pvRes.data ?? []) as unknown as PvRow[]);
    setDocs((docRes.data ?? []) as unknown as DocumentRow[]);
    setAttestationsEligibles(eligiblesRes.count ?? 0);
  }, [supabase]);

  // Rattrapage permanent : reste affiché en continu (contrairement à l'alerte du
  // Centre de pilotage, qui disparaît une fois soldée) -- ne génère effectivement
  // que si des lots remplissent les conditions d'éligibilité (rejoue exactement
  // la règle du trigger via generer_attestations_gratuites_manquantes()).
  const genererAttestations = useCallback(async () => {
    setGenererEnCours(true);
    setGenererErreur(null);
    const { error } = await supabase.rpc("generer_attestations_gratuites_manquantes");
    setGenererEnCours(false);
    if (error) {
      setGenererErreur(error.message);
      return;
    }
    void load();
  }, [load, supabase]);

  const { isLoading: loading, recharger } = useChargement(load, [load]);

  // Récupère une URL signée pour un document générique (table "documents")
  const signerDocument = useCallback(async (id: string, variant: "original" | "apercu") => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/telecharger-document`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ table: "documents", reference: id, variant }),
      }
    );
    const json = await res.json();
    if (!res.ok || !json.url) throw new Error(json.erreur || "Erreur");
    return json.url as string;
  }, [supabase]);

  // Charge les vignettes des plans dès qu'un apercu est disponible
  useEffect(() => {
    const aCharger = docs.filter(
      (d) => (d.type === "plan_lot" || d.type === "plan_lotissement") && d.apercu_url && !apercuUrls[d.id]
    );
    if (aCharger.length === 0) return;
    (async () => {
      for (const doc of aCharger) {
        try {
          const url = await signerDocument(doc.id, "apercu");
          setApercuUrls((s) => ({ ...s, [doc.id]: url }));
        } catch {
          // silencieux : la vignette restera en état "chargement"
        }
      }
    })();
  }, [docs, apercuUrls, signerDocument]);

  const telechargerOriginalPlan = async (id: string) => {
    try {
      const url = await signerDocument(id, "original");
      window.open(url, "_blank");
    } catch {
      // erreur silencieuse, pas de state dédié pour ce bouton
    }
  };

  /** Renvoie un message d'erreur à afficher dans la modale, ou null si c'est passé. */
  const revoquer = async (id: string, motif: string): Promise<string | null> => {
    const { error } = await supabase.rpc("revoquer_attestation", { p_id: id, p_motif: motif });
    if (error) return error.message;
    void load();
    return null;
  };

  /**
   * Constater une signature portée sur le document papier. Passe par une RPC
   * et non par un `update` direct : la chefferie n'a qu'une policy SELECT sur
   * `attestations_cession`, et un update bloqué par RLS ne lève AUCUNE erreur
   * — il touche 0 ligne en silence. C'est ce qui rendait l'ancien bouton de
   * `/dashboard/validations` inopérant sans que personne ne le voie.
   */
  const signerAttestation = async (att: AttestationRow, signature: string) => {
    setSignatureEnCours(`${att.id}:${signature}`);
    setErreurAction(null);
    const { error } = await supabase.rpc("signer_attestation", {
      p_id: att.id,
      p_signature: signature,
    });
    setSignatureEnCours(null);
    if (error) {
      setErreurAction(error.message);
      return;
    }
    void load();
  };

  const marquerDelivree = async (id: string) => {
    setRemiseState((s) => ({ ...s, [id]: "loading" }));
    setErreurAction(null);
    const { error } = await supabase.rpc("marquer_attestation_delivree", { p_id: id });
    if (error) {
      // Le refus nomme les signatures manquantes : le montrer, plutôt que de
      // laisser un bouton qui clignote en rouge sans dire pourquoi.
      setErreurAction(error.message);
      setRemiseState((s) => ({ ...s, [id]: "error" }));
      setTimeout(() => setRemiseState((s) => ({ ...s, [id]: "idle" })), 2500);
      return;
    }
    setRemiseState((s) => ({ ...s, [id]: "idle" }));
    void load();
  };

  const telecharger = async (reference: string) => {
    setDlState((s) => ({ ...s, [reference]: "loading" }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/telecharger-document`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token ?? ""}`,
          },
          body: JSON.stringify({ table: "attestations_cession", reference }),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.erreur || "Erreur");
      window.open(json.url, "_blank");
      setDlState((s) => ({ ...s, [reference]: "idle" }));
    } catch {
      setDlState((s) => ({ ...s, [reference]: "error" }));
      setTimeout(() => setDlState((s) => ({ ...s, [reference]: "idle" })), 2500);
    }
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { id: "attestations", label: "Attestations", icon: <FileCheck className="h-4 w-4" />, count: attestations.length },
    { id: "pv", label: "PV de famille", icon: <FileSignature className="h-4 w-4" />, count: pvs.length },
    { id: "documents", label: "Documents", icon: <FileText className="h-4 w-4" />, count: docs.length },
  ];

  const delivrees = attestations.filter((a) => a.statut === "delivree").length;
  const pvValides = pvs.filter((p) => p.statut === "valide").length;

  return (
    <AppShell loading={loading} counts={counts} onRefresh={recharger}>
      {/* En-tête */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">
            Coffre-fort documentaire
          </h1>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            Attestations de cession, PV de famille et documents officiels.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <BoutonImprimer />
          {isAdmin && (
            <Button
              type="button"
              variant="outline"
              className="print:hidden"
              onClick={genererAttestations}
              disabled={attestationsEligibles === 0 || genererEnCours}
              loading={genererEnCours}
              title={
                attestationsEligibles === 0
                  ? "Aucune attestation gratuite éligible en attente : les conditions ne sont pas réunies."
                  : `${attestationsEligibles} lot${attestationsEligibles > 1 ? "s" : ""} éligible${attestationsEligibles > 1 ? "s" : ""} à l'attestation gratuite, jamais générée (imports faits trigger désactivé).`
              }
            >
              {genererEnCours ? null : <Sparkles className="h-4 w-4" />}
              {genererEnCours
                ? "Génération…"
                : attestationsEligibles > 0
                  ? `Générer les attestations éligibles (${attestationsEligibles})`
                  : "Générer les attestations éligibles"}
            </Button>
          )}
          {peutTeleverserPlan && (
            <Button type="button" variant="primary" className="print:hidden" onClick={() => setShowUpload(true)}>
              <Upload className="h-4 w-4" />
              Téléverser un plan
            </Button>
          )}
        </div>
      </div>

      {genererErreur && (
        <p role="alert" className="rounded-xl border border-danger/25 bg-danger-subtle px-4 py-2.5 text-sm font-medium text-danger">
          Échec de la génération des attestations : {genererErreur}
        </p>
      )}

      {/* KPIs */}
      <motion.section
        variants={stagger(0, 0.05)}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Indicateurs documentaires"
      >
        <Kpi icon={FileCheck} label="Attestations" loading={loading} value={attestations.length} legende={<>au coffre-fort</>} />
        <Kpi icon={PackageCheck} label="Délivrées" loading={loading} value={delivrees} legende={<>remises au bénéficiaire</>} />
        <Kpi icon={FileSignature} label="PV de famille" loading={loading} value={pvs.length} legende={<>collectifs d&apos;ayants-droit</>} />
        <Kpi icon={CheckCircle2} label="PV validés" loading={loading} value={pvValides} legende={<>approuvés</>} />
      </motion.section>

      {/* Onglets */}
      <motion.div variants={fadeUp} initial="hidden" animate="show">
        <Card className="overflow-hidden">
          {/* Barre d'onglets */}
          <div className="flex border-b border-border">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition ${
                  activeTab === tab.id
                    ? "border-b-2 border-accent text-accent"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.icon}
                {tab.label}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    activeTab === tab.id ? "bg-accent-subtle text-accent" : "bg-inset text-muted-foreground"
                  }`}
                >
                  {loading ? "…" : tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Contenu */}
          {loading ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              Chargement…
            </div>
          ) : activeTab === "attestations" ? (
            <AttestationsTab
              rows={attestations}
              dlState={dlState}
              remiseState={remiseState}
              onRevoquer={isAdmin ? setARevoquer : undefined}
              onSigner={signerAttestation}
              signatureEnCours={signatureEnCours}
              erreurAction={erreurAction}
              onDownload={telecharger}
              onShowQr={setQrAtt}
              onMarquerDelivree={marquerDelivree}
            />
          ) : activeTab === "pv" ? (
            <PvTab rows={pvs} />
          ) : (
            <DocumentsTab
              rows={docs}
              apercuUrls={apercuUrls}
              dlOriginal={telechargerOriginalPlan}
              onOpenLightbox={setLightbox}
            />
          )}
        </Card>
      </motion.div>

      {qrAtt && <QrModal att={qrAtt} onClose={() => setQrAtt(null)} />}

      {aRevoquer && (
        <RevocationModal
          att={aRevoquer}
          onClose={() => setARevoquer(null)}
          onConfirm={(motif) => revoquer(aRevoquer.id, motif)}
        />
      )}

      {showUpload && (
        <UploadPlanModal
          onClose={() => setShowUpload(false)}
          onUploaded={() => void load()}
        />
      )}

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-6"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Aperçu du plan" className="max-h-full max-w-full rounded-lg shadow-2xl" />
        </div>
      )}
    </AppShell>
  );
}
