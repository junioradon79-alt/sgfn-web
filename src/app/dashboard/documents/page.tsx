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
  ShieldAlert,
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ds/tooltip";
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
import { SEUIL_RATTRAPAGE } from "@/lib/rattrapage-attestations";
import { messageLecture } from "@/lib/supabase-pagination";
// Table des droits sur les attestations — miroir des gardes serveur, partagée
// avec l'app mobile. Elle vit sous `features/mobile` parce qu'elle y a été
// écrite, mais elle n'a rien de spécifique au mobile.
import { attestationsPour } from "@/features/mobile/roles";

// ─── Types ────────────────────────────────────────────────────────────────────

type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

/** Ligne brute de `v_attestations_bloquees_documents`. */
type BlocageRow = { lotissement: string | null; score: number | null; manques: string[] | null };

/** Le même blocage, replié sur le lotissement — c'est lui qui porte la cause. */
type BlocageLotissement = { lotissement: string; score: number; manques: string[] };

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
  exception: boolean;
  exception_motif: string | null;
  exception_le: string | null;
  exception_par: { nom_complet: string | null } | null;
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

/**
 * Attestation d'Attribution de Lot (Niveau 2/3, 23/07/2026) — document unique
 * par lot, mis à jour en place à chaque transfert. Forme délibérément
 * sur-ensemble de `AttestationRow` : `SigDots`/`ExceptionBadge`/`QrModal`/
 * `RevocationModal` sont réutilisés tels quels (typage structurel).
 */
type AttributionRow = {
  id: string;
  reference: string;
  statut: string;
  date_emission: string | null;
  cree_le: string;
  sig_proprietaire_le: string | null;
  sig_operateur_le: string | null;
  sig_chefferie_le: string | null;
  qr_token: string | null;
  exception: boolean;
  exception_motif: string | null;
  exception_le: string | null;
  exception_par: { nom_complet: string | null } | null;
  lots: {
    numero_lot: string | null;
    ilots: {
      numero: string | null;
      lotissements: {
        nom: string | null;
        signatures_requises: string[] | null;
        famille_id: string | null;
      } | null;
    } | null;
  } | null;
  attributaires: { nom: string | null } | null;
  niveau: number;
  gratuite: boolean;
  nom_identifie_physique: string | null;
  signature_payee_le: string | null;
  antecedent_attestation_cession_id: string | null;
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
  nom_fichier: string | null;
  lots: { numero_lot: string | null; ilots: { lotissements: { nom: string | null } | null } | null } | null;
  // Depuis la migration 20260729170000, un document peut être rattaché au
  // LOTISSEMENT et non à un lot. Sans cette jointure, un plan de morcellement
  // s'affichait ici avec « Lot associé : — », c'est-à-dire comme un document
  // orphelin alors qu'il est parfaitement rattaché.
  lotissements: { nom: string | null } | null;
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
  onRetirer,
  signaturesAutorisees,
  enCours,
}: {
  att: AttestationRow;
  onSigner?: (att: AttestationRow, signature: string) => void;
  /**
   * Signatures que CE rôle peut constater — cf. `attestationsPour`, miroir des
   * gardes serveur partagé avec l'app mobile.
   *
   * Sans ce filtre, la pastille était cliquable pour tout le monde : un
   * `proprietaire_terrien` voit 12 attestations sur cet écran et pouvait taper
   * trois boutons que le serveur refuse. Une chefferie, elle, ne peut constater
   * QUE la sienne. Offrir un geste voué au refus est le défaut que ce dépôt
   * combat partout ailleurs.
   */
  signaturesAutorisees?: string[];
  /**
   * Retirer une signature constatée par erreur — réservé à l'admin.
   *
   * `annuler_signature_attestation` existait en base **depuis le 22/07 sans
   * qu'aucun écran ne l'appelle** : une signature cochée par erreur n'avait
   * donc aucun recours applicatif, alors que sa migration justifiait
   * elle-même la fonction (« cocher est faillible ; sans marche arrière, une
   * erreur de saisie bloquerait la délivrance sans recours »). Le risque a
   * monté d'un cran avec l'app mobile, où le constat se fait au pouce sur le
   * terrain.
   */
  onRetirer?: (att: AttestationRow, signature: string) => void;
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
        const permise = !signaturesAutorisees || signaturesAutorisees.includes(s.cle);
        const cliquable = Boolean(onSigner) && permise && requise && !date && !revoquee;
        // Le retrait n'a de sens que tant que le document n'est pas remis :
        // `annuler_signature_attestation` refuse d'ailleurs une attestation
        // `delivree` (« retirer une signature n'aurait plus de sens »). On ne
        // propose donc pas un geste que le serveur rejettera.
        const retirable =
          Boolean(onRetirer) && requise && Boolean(date) && !revoquee && att.statut !== "delivree";
        const titre = !requise
          ? `${label} — non requise pour ce lotissement`
          : date
            ? retirable
              ? `${label} — constatée le ${fmtDate(date)} · cliquer pour retirer ce constat`
              : `${label} — constatée le ${fmtDate(date)}`
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
        if (cliquable || retirable) {
          return (
            <button
              key={s.cle}
              type="button"
              onClick={() => (retirable ? onRetirer?.(att, s.cle) : onSigner?.(att, s.cle))}
              disabled={enCours === `${att.id}:${s.cle}`}
              aria-label={titre}
              className="rounded-full p-0.5 transition hover:bg-inset disabled:opacity-50"
            >
              {pastille}
            </button>
          );
        }
        return (
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

/**
 * Marque une attestation née d'une génération exceptionnelle (dossier
 * documentaire incomplet, dérogation admin) — voir la migration du 23/07 et
 * `generer_attestation_exceptionnelle`. L'horodatage, l'auteur et le motif
 * sont ceux demandés par le commanditaire, portés directement par la ligne.
 */
function ExceptionBadge({ att }: { att: AttestationRow }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-0.5 rounded bg-warning-subtle px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-warning uppercase">
          <ShieldAlert className="size-2.5" aria-hidden />
          Except.
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="font-semibold">Génération exceptionnelle</p>
        <p className="mt-1 opacity-90">
          {att.exception_par?.nom_complet ?? "Administrateur"} · {fmtDate(att.exception_le)}
        </p>
        {att.exception_motif && <p className="mt-1 opacity-80">{att.exception_motif}</p>}
      </TooltipContent>
    </Tooltip>
  );
}

// ─── Onglet Attestations ──────────────────────────────────────────────────────

function AttestationsTab({ rows, dlState, remiseState, onDownload, onShowQr, onMarquerDelivree, onRevoquer, onSigner, onRetirer, signaturesAutorisees, signatureEnCours, erreurAction, chargeErreur }: {
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
  /** Retirer un constat — admin seul (`annuler_signature_attestation`). */
  onRetirer?: (att: AttestationRow, signature: string) => void;
  /** Signatures constatables par ce rôle — cf. `attestationsPour`. */
  signaturesAutorisees?: string[];
  signatureEnCours?: string | null;
  erreurAction?: string | null;
  /** Motif d'une lecture refusée : « 0 attestation » ne doit jamais être
   *  affirmé quand la liste est vide FAUTE D'AVOIR PU LIRE (dette #45). */
  chargeErreur?: string | null;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-sm text-muted-foreground">
        <FileCheck className="mb-3 h-8 w-8 text-muted-2" />
        {chargeErreur ? (
          <span role="alert" className="max-w-xl font-medium text-danger">
            Liste non lue — {chargeErreur}
          </span>
        ) : (
          "Aucune attestation enregistrée."
        )}
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
                  <div className="flex items-center gap-1.5">
                    {att.reference}
                    {att.exception && <ExceptionBadge att={att} />}
                  </div>
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
                  <SigDots att={att} onSigner={onSigner} onRetirer={onRetirer} signaturesAutorisees={signaturesAutorisees} enCours={signatureEnCours} />
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

// ─── Onglet Attributions de lot (Niveau 2/3) ───────────────────────────────────
// Document unique par lot, mis à jour en place à chaque transfert — pas
// d'historique de lignes soeurs comme pour les attestations de cession, mais
// un badge Niveau + statut du paiement de signature Chefferie (360 000 FCFA
// chefferie + 20 000 FCFA commission SGNF, requis avant que `sig_chefferie_le`
// puisse être constatée — cf. migration du 23/07).

function AttributionsTab({ rows, dlState, remiseState, onDownload, onShowQr, onMarquerDelivree, onRevoquer, onSigner, onRetirer, signaturesAutorisees, signatureEnCours, erreurAction, chargeErreur }: {
  rows: AttributionRow[];
  dlState: DlState;
  remiseState: DlState;
  onDownload: (ref: string) => void;
  onShowQr: (att: AttributionRow) => void;
  onMarquerDelivree: (id: string) => void;
  onRevoquer?: (att: AttributionRow) => void;
  /** Typé sur `AttestationRow` (pas `AttributionRow`) : c'est le type attendu par
   * `SigDots`, qui appelle ce callback en interne avec son propre paramètre `att`. */
  onSigner?: (att: AttestationRow, signature: string) => void;
  /** Même typage structurel que `onSigner`, pour la même raison. */
  onRetirer?: (att: AttestationRow, signature: string) => void;
  /** Signatures constatables par ce rôle — cf. `attestationsPour`. */
  signaturesAutorisees?: string[];
  signatureEnCours?: string | null;
  erreurAction?: string | null;
  /** Cf. `AttestationsTab` : « aucune » ne s'affirme que si la lecture a abouti. */
  chargeErreur?: string | null;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-sm text-muted-foreground">
        <FileSignature className="mb-3 h-8 w-8 text-muted-2" />
        {chargeErreur ? (
          <span role="alert" className="max-w-xl font-medium text-danger">
            Liste non lue — {chargeErreur}
          </span>
        ) : (
          "Aucune Attestation d'Attribution de Lot enregistrée."
        )}
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
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className={TH_CLASS}>Référence</th>
            <th className={TH_CLASS}>Lot</th>
            <th className={TH_CLASS}>Titulaire actuel</th>
            <th className={TH_CLASS}>Niveau</th>
            <th className={TH_CLASS}>Paiement signature</th>
            <th className={TH_CLASS}>Signatures</th>
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
                  <div className="flex items-center gap-1.5">
                    {att.reference}
                    {att.exception && <ExceptionBadge att={att} />}
                  </div>
                </td>
                <td className="px-5 py-3.5 text-foreground">
                  {lotLabel}
                  {lotissement && <p className="text-xs text-muted-2">{lotissement}</p>}
                </td>
                <td className="px-5 py-3.5 text-muted-foreground">
                  {att.attributaires?.nom ?? "—"}
                </td>
                <td className="px-5 py-3.5">
                  <Badge tone={att.niveau === 2 ? "accent" : "warning"}>Niveau {att.niveau}</Badge>
                  <p className="mt-0.5 text-xs text-muted-2">
                    QR {att.gratuite ? "gratuit" : "payant"}
                  </p>
                </td>
                <td className="px-5 py-3.5">
                  <Badge tone={att.signature_payee_le ? "success" : "warning"}>
                    {att.signature_payee_le ? "Reçu" : "En attente"}
                  </Badge>
                </td>
                <td className="px-5 py-3.5">
                  <SigDots att={att} onSigner={onSigner} onRetirer={onRetirer} signaturesAutorisees={signaturesAutorisees} enCours={signatureEnCours} />
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

function PvTab({ rows, chargeErreur }: { rows: PvRow[]; chargeErreur?: string | null }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-sm text-muted-foreground">
        <FileSignature className="mb-3 h-8 w-8 text-muted-2" />
        {chargeErreur ? (
          <span role="alert" className="max-w-xl font-medium text-danger">
            Liste non lue — {chargeErreur}
          </span>
        ) : (
          "Aucun PV de famille enregistré."
        )}
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

function PlanApercu({ doc, apercuUrl, onOpenLightbox, chargeLe }: {
  doc: DocumentRow;
  apercuUrl: string | undefined;
  onOpenLightbox: (url: string) => void;
  /** Horodatage de la lecture de la liste. Relevé dans `load()`, pas ici. */
  chargeLe: number | null;
}) {
  if (!doc.apercu_url) {
    // Une vignette absente a DEUX causes, et les confondre reproduirait le
    // défaut corrigé quelques lignes plus bas (« un état d'attente perpétuel
    // présenté comme un progrès ») :
    //  · la conversion DXF → vignette tourne encore — quelques secondes ;
    //  · elle n'aboutira JAMAIS. Depuis le 09/08, `UploadPlanModal` écrit la
    //    ligne AVANT d'envoyer le binaire (la policy storage l'exige, cf.
    //    migration 20260809100000) : un envoi échoué laisse donc une fiche
    //    sans fichier. Cette classe de lignes n'existait pas avant.
    // Rien dans la ligne ne les distingue — `apercu_url` est NULL dans les
    // deux cas. Le temps, lui, tranche : au-delà du seuil, annoncer une
    // conversion en cours est un mensonge, et il serait lu comme tel par le
    // géomètre MAIS AUSSI par la chefferie et l'opérateur, qui lisent ces
    // mêmes lignes.
    // ⚠️ « Aperçu indisponible », et surtout PAS « Fiche incomplète » : le
    // libellé accusateur serait un FAUX ROUGE sur un plan réel du registre.
    // Relu en base le 09/08, les deux seuls `plan_lot` sont au format `.dwg` —
    // que `convertir-plan-cad` ne convertit pas, il traite le DXF — et l'un
    // des deux (`7d3a3f04…`) n'a PAS d'aperçu, alors que son binaire existe et
    // se télécharge. (L'autre, `16dbe0f9…`, en a un : `apercu.png`, vestige de
    // la version CloudConvert. Une première rédaction de ce commentaire les
    // disait tous deux sans aperçu — faux, et relevé par le vérificateur.)
    // Une vignette absente ne prouve pas qu'il manque un fichier ; elle prouve
    // seulement qu'il n'y a pas de vignette. Dire l'un pour l'autre alarmerait
    // la chefferie et l'opérateur, qui lisent ces mêmes lignes.
    const attenteMs = chargeLe === null ? 0 : chargeLe - new Date(doc.televerse_le).getTime();
    if (attenteMs > 15 * 60 * 1000) {
      return (
        <Badge tone="neutral">
          <ImageIcon /> Aperçu indisponible
        </Badge>
      );
    }
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

function DocumentsTab({ rows, apercuUrls, dlOriginal, onOpenLightbox, chargeErreur, erreurAction, chargeLe }: {
  rows: DocumentRow[];
  apercuUrls: Record<string, string>;
  dlOriginal: (id: string) => void;
  onOpenLightbox: (url: string) => void;
  chargeErreur?: string | null;
  /** Horodatage de la lecture de la liste, relevé dans `load()`. */
  chargeLe: number | null;
  /**
   * Le motif d'un téléchargement refusé. Cet onglet était le seul des quatre
   * à ne pas en avoir : `telechargerOriginalPlan` avalait son erreur en
   * silence (« pas de state dédié pour ce bouton »), donc un clic sur une
   * fiche sans fichier ne produisait RIEN — ni fichier, ni motif. C'est la
   * forme la plus discrète de la dette #45, et l'inversion du 09/08 la rend
   * atteignable pour de bon.
   */
  erreurAction?: string | null;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-sm text-muted-foreground">
        <FileText className="mb-3 h-8 w-8 text-muted-2" />
        {chargeErreur ? (
          <span role="alert" className="max-w-xl font-medium text-danger">
            Liste non lue — {chargeErreur}
          </span>
        ) : (
          "Aucun document téléversé."
        )}
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
      <table className="w-full min-w-[700px] text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className={TH_CLASS}>Type</th>
            <th className={TH_CLASS}>Titre</th>
            <th className={TH_CLASS}>Aperçu</th>
            <th className={TH_CLASS}>Rattaché à</th>
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
            // Deux notions distinctes, qui étaient confondues :
            //  · `estPlanCao` — le plan de LOT, seul à passer par la chaîne de
            //    conversion DXF → vignette (`convertir-plan-cad`) ;
            //  · `estPlan` — tout plan, donc tout fichier vivant dans le bucket
            //    privé et téléchargeable via l'edge function.
            // Les mélanger affichait « Conversion en cours » sur un plan de
            // morcellement PDF, qui n'attend aucune conversion et n'en attendra
            // jamais : un état d'attente perpétuel présenté comme un progrès.
            const estPlanCao = doc.type === "plan_lot";
            const estPlan = estPlanCao || doc.type === "plan_lotissement";
            return (
              <tr key={doc.id} className="transition hover:bg-inset/60">
                <td className="px-5 py-3.5">
                  <Badge tone="neutral">{DOC_TYPE_LABEL[doc.type] ?? doc.type}</Badge>
                </td>
                <td className="px-5 py-3.5 text-foreground">
                  {doc.titre ?? <span className="text-muted-2">Sans titre</span>}
                </td>
                <td className="px-5 py-3.5">
                  {estPlanCao ? (
                    <PlanApercu doc={doc} apercuUrl={apercuUrls[doc.id]} onOpenLightbox={onOpenLightbox} chargeLe={chargeLe} />
                  ) : doc.nom_fichier ? (
                    <span className="text-xs text-muted-2" title={doc.nom_fichier}>
                      {doc.nom_fichier.split(".").pop()?.toUpperCase() ?? "—"}
                    </span>
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
                  ) : doc.lotissements?.nom ? (
                    <>
                      {doc.lotissements.nom}
                      <p className="text-xs text-muted-2">tout le lotissement</p>
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

/**
 * Retirer un constat de signature.
 *
 * Le geste est correctif, pas destructeur — on peut re-constater ensuite —
 * mais il **perd l'horodatage d'origine** : `signer_attestation` est
 * idempotent (`coalesce`), si bien qu'une nouvelle constatation portera la
 * date du jour et non celle du constat initial. C'est ce qui justifie une
 * confirmation, là où un simple clic suffit pour constater.
 *
 * Pas de motif demandé : la RPC n'en accepte pas, et en inventer un ici le
 * ferait disparaître dans le vide.
 */
function RetraitSignatureModal({ att, signature, onClose, onConfirm }: {
  att: AttestationRow;
  signature: string;
  onClose: () => void;
  onConfirm: () => Promise<string | null>;
}) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const label = libelleSignature(signature, Boolean(att.lots?.ilots?.lotissements?.famille_id));
  const dateDe: Record<string, string | null> = {
    proprietaire: att.sig_proprietaire_le,
    operateur: att.sig_operateur_le,
    chefferie: att.sig_chefferie_le,
  };

  const confirmer = async () => {
    setEnCours(true);
    setErreur(null);
    const message = await onConfirm();
    setEnCours(false);
    if (message) setErreur(message);
    else onClose();
  };

  return (
    <Dialog open onOpenChange={(ouvert) => { if (!ouvert && !enCours) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Retirer le constat de signature</DialogTitle>
          <DialogDescription className="font-mono">{att.reference}</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <p className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-foreground">
            La signature <strong>{label}</strong>, constatée le{" "}
            <strong>{fmtDate(dateDe[signature])}</strong>, sera retirée. L&apos;attestation
            redeviendra incomplète et ne pourra plus être remise tant qu&apos;elle n&apos;aura
            pas été constatée à nouveau.
          </p>
          <p className="text-sm text-muted-foreground">
            À n&apos;utiliser que pour corriger une erreur de saisie. La date du constat
            d&apos;origine est <strong>perdue</strong> : une nouvelle constatation portera la
            date du jour.
          </p>

          {erreur && (
            <p className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-2.5 text-sm text-danger">
              {erreur}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={enCours}>
              Annuler
            </Button>
            <Button type="button" variant="danger" onClick={confirmer} disabled={enCours}>
              {enCours && <LoaderIcon className="h-4 w-4 animate-spin" />}
              Retirer le constat
            </Button>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Confirmation chiffrée du rattrapage de masse.
 *
 * On demande de **retranscrire le nombre**, et non de cliquer « OK » : un
 * bouton de confirmation se clique sans lire, un nombre se recopie en l'ayant
 * lu. C'est le même contrat que celui tenu par la RPC, qui exige de lui
 * repasser ce nombre exact.
 */
function RattrapageModal({ nombre, onClose, onConfirm }: {
  nombre: number;
  onClose: () => void;
  onConfirm: () => Promise<string | null>;
}) {
  const [saisie, setSaisie] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const valide = saisie.trim() === String(nombre);

  const confirmer = async () => {
    if (!valide) return;
    setEnCours(true);
    setErreur(null);
    const message = await onConfirm();
    setEnCours(false);
    if (message) setErreur(message);
    else onClose();
  };

  return (
    <Dialog open onOpenChange={(ouvert) => { if (!ouvert && !enCours) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Générer {nombre} attestations d&apos;un coup</DialogTitle>
          <DialogDescription>Opération de masse — à confirmer explicitement.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <p className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-foreground">
            <strong>{nombre} attestations</strong> seront créées et autant de PDF générés. Chacune
            portera une référence et un QR définitifs. Il n&apos;existe pas d&apos;annulation en
            masse : revenir en arrière se ferait attestation par attestation.
          </p>

          <div className="space-y-1.5">
            <label htmlFor="confirmation-rattrapage" className="text-sm font-medium text-foreground">
              Saisissez <span className="font-mono font-bold">{nombre}</span> pour confirmer
            </label>
            <input
              id="confirmation-rattrapage"
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              inputMode="numeric"
              autoComplete="off"
              className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 font-mono text-sm text-foreground shadow-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
            />
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
            <Button type="button" variant="primary" onClick={confirmer} disabled={!valide || enCours}>
              {enCours && <LoaderIcon className="h-4 w-4 animate-spin" />}
              Générer les {nombre} attestations
            </Button>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

type Tab = "attestations" | "attributions" | "pv" | "documents";

export default function DocumentsPage() {
  const supabase = useMemo(() => createClient(), []);
  const { profile, isAdmin } = useProfile();
  const { counts } = useBadgeCounts();
  const [activeTab, setActiveTab] = useState<Tab>("attestations");
  const [attestations, setAttestations] = useState<AttestationRow[]>([]);
  const [attributionsLot, setAttributionsLot] = useState<AttributionRow[]>([]);
  const [pvs, setPvs] = useState<PvRow[]>([]);
  const [docs, setDocs] = useState<DocumentRow[]>([]);

  const [dlState, setDlState] = useState<DlState>({});
  const [remiseState, setRemiseState] = useState<DlState>({});
  const [aRevoquer, setARevoquer] = useState<AttestationRow | null>(null);
  const [signatureEnCours, setSignatureEnCours] = useState<string | null>(null);
  const [erreurAction, setErreurAction] = useState<string | null>(null);
  const [qrAtt, setQrAtt] = useState<AttestationRow | null>(null);
  const [dlStateAttrib, setDlStateAttrib] = useState<DlState>({});
  const [remiseStateAttrib, setRemiseStateAttrib] = useState<DlState>({});
  const [aRevoquerAttrib, setARevoquerAttrib] = useState<AttributionRow | null>(null);
  const [signatureEnCoursAttrib, setSignatureEnCoursAttrib] = useState<string | null>(null);
  const [erreurActionAttrib, setErreurActionAttrib] = useState<string | null>(null);
  /** Motif d'un téléchargement de plan refusé — voir `telechargerOriginalPlan`. */
  const [erreurDocument, setErreurDocument] = useState<string | null>(null);
  const [qrAttrib, setQrAttrib] = useState<AttributionRow | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [apercuUrls, setApercuUrls] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [attestationsEligibles, setAttestationsEligibles] = useState(0);
  const [attestationsBloquees, setAttestationsBloquees] = useState(0);
  const [blocagesParLotissement, setBlocagesParLotissement] = useState<BlocageLotissement[]>([]);
  const [genererEnCours, setGenererEnCours] = useState(false);
  const [genererErreur, setGenererErreur] = useState<string | null>(null);
  /** Motif d'une des sept lectures tombée — cf. le bilan en fin de `load`. */
  const [chargeErreur, setChargeErreur] = useState<string | null>(null);
  /** Horodatage de la dernière lecture de la liste — voir `load()`. */
  const [chargeLe, setChargeLe] = useState<number | null>(null);
  const [confirmRattrapage, setConfirmRattrapage] = useState(false);
  /** Constat de signature en cours de retrait (admin) — cf. `RetraitSignatureModal`. */
  const [retrait, setRetrait] = useState<{ att: AttestationRow; signature: string } | null>(null);
  const [retraitAttrib, setRetraitAttrib] = useState<{ att: AttestationRow; signature: string } | null>(null);

  /**
   * Inchangé par le resserrement de la dette #33 (20260809100000), et
   * vérifié comme tel : le `with check` de `documents_geometre_plans_insert`
   * accepte toujours tout géomètre — il exige seulement que le dépôt soit
   * fait EN SON PROPRE NOM (`televerse_par = auth.uid()`), pas qu'il porte
   * une mission sur le lot. Le bouton ne promet donc rien que la base
   * refuse. Ce qui a changé est la LECTURE : il ne verra ensuite que les
   * plans qu'il a déposés, plus ceux des lots où il est en mission.
   */
  const peutTeleverserPlan = isAdmin || profile?.groupe === "geometre";
  /**
   * Ce que ce rôle peut faire sur une attestation. La table vient de
   * `features/mobile/roles.ts` — elle y a été écrite pour l'app, mais elle est
   * le **miroir des gardes serveur**, donc commune aux deux surfaces. En
   * recopier une seconde ici la ferait diverger au premier changement de
   * garde ; c'est exactement ce qui est arrivé aux libellés de signature,
   * dupliqués puis réunifiés dans `@/lib/signatures-attestation`.
   */
  const actionsAttestation = useMemo(() => attestationsPour(profile?.groupe), [profile?.groupe]);

  const load = useCallback(async () => {
    const [attRes, attribRes, pvRes, docRes, eligiblesRes, bloqueesRes, detailRes] = await Promise.all([
      supabase
        .from("attestations_cession")
        .select(
          "id, reference, statut, date_emission, cree_le, sig_proprietaire_le, sig_operateur_le, sig_chefferie_le, qr_token, exception, exception_motif, exception_le, exception_par:profiles!attestations_cession_exception_par_fkey(nom_complet), lots(numero_lot, ilots(numero, lotissements(nom, signatures_requises, famille_id))), attributaires(nom)"
        )
        .order("cree_le", { ascending: false }),
      supabase
        .from("attestations_attribution_lot")
        .select(
          "id, reference, statut, date_emission, cree_le, sig_proprietaire_le, sig_operateur_le, sig_chefferie_le, qr_token, exception, exception_motif, exception_le, exception_par:profiles!attestations_attribution_lot_exception_par_fkey(nom_complet), lots(numero_lot, ilots(numero, lotissements(nom, signatures_requises, famille_id))), attributaires(nom), niveau, gratuite, nom_identifie_physique, signature_payee_le, antecedent_attestation_cession_id"
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
          "id, type, titre, emetteur, date_document, url_fichier, apercu_url, hash_fichier, televerse_le, nom_fichier, lots(numero_lot, ilots(lotissements(nom))), lotissements(nom)"
        )
        .order("televerse_le", { ascending: false }),
      supabase.from("v_attestations_gratuites_manquantes").select("lot_id", { count: "exact", head: true }),
      // Deux lectures de la même vue : le compte exact d'un côté, et de l'autre
      // un échantillon borné qui suffit à nommer les lotissements en cause et
      // leurs manques. Charger les 841 lignes pour n'en afficher que le résumé
      // serait payer le transport d'une liste qu'on n'affiche jamais.
      supabase.from("v_attestations_bloquees_documents").select("lot_id", { count: "exact", head: true }),
      supabase
        .from("v_attestations_bloquees_documents")
        .select("lotissement, score, manques")
        .limit(400),
    ]);
    setAttestations((attRes.data ?? []) as unknown as AttestationRow[]);
    setAttributionsLot((attribRes.data ?? []) as unknown as AttributionRow[]);
    setPvs((pvRes.data ?? []) as unknown as PvRow[]);
    setDocs((docRes.data ?? []) as unknown as DocumentRow[]);
    // L'heure est relevée ICI, dans le callback de chargement, et pas pendant
    // le rendu : `Date.now()` en plein rendu rend le composant impur
    // (`react-hooks/purity`), et le déplacer dans un effet se heurte à
    // `react-hooks/set-state-in-effect`. Un callback asynchrone est le bon
    // endroit — et c'est aussi le plus juste sémantiquement : l'ancienneté
    // d'une fiche se juge par rapport au moment où on a lu la liste.
    setChargeLe(Date.now());
    setAttestationsEligibles(eligiblesRes.count ?? 0);
    setAttestationsBloquees(bloqueesRes.count ?? 0);
    // Tous les lots d'un lotissement sont bloqués pour la même raison : on replie
    // donc sur les lotissements distincts au lieu d'énumérer les lots.
    const parLotissement = new Map<string, BlocageLotissement>();
    for (const r of (detailRes.data ?? []) as BlocageRow[]) {
      if (r.lotissement && !parLotissement.has(r.lotissement)) {
        parLotissement.set(r.lotissement, {
          lotissement: r.lotissement,
          score: r.score ?? 0,
          manques: r.manques ?? [],
        });
      }
    }
    setBlocagesParLotissement([...parLotissement.values()]);

    // 🔴 Le Coffre-fort documentaire est l'écran où la consigne « toute
    // attestation doit être lisible par les parties concernées » se vérifiera.
    // Aucune des sept lectures n'inspectait son `error` : un refus RLS y rendait
    // « 0 attestation » — exactement la dette #45, où un refus se lisait comme
    // une bonne nouvelle là où l'admin en voyait 822. Tant que ce bandeau
    // n'existait pas, aucun élargissement de droit n'était vérifiable ici.
    const echecs = (
      [
        ["les attestations de cession", attRes.error],
        ["les attestations d'attribution de lot", attribRes.error],
        ["les PV de réunion de famille", pvRes.error],
        ["les documents téléversés", docRes.error],
        ["le compte des attestations éligibles", eligiblesRes.error],
        ["le compte des attestations bloquées", bloqueesRes.error],
        ["le détail des blocages par lotissement", detailRes.error],
      ] as const
    )
      .filter(([, e]) => !!e)
      .map(([quoi, e]) => messageLecture(quoi, e!));
    setChargeErreur(echecs.length ? echecs.join(" · ") : null);
  }, [supabase]);

  // Rattrapage permanent : reste affiché en continu (contrairement à l'alerte du
  // Centre de pilotage, retirée le 22/07) -- ne génère que les lots dont le
  // lotissement porte une APFC, les autres relevant de `attestationsBloquees`.
  // Au-delà du seuil, la RPC exige qu'on lui répète le nombre exact : la modale
  // demande donc la confirmation AVANT l'appel, plutôt que d'essuyer le refus.
  // `p_confirmation` est omis sous le seuil : la RPC lui donne alors sa valeur
  // par defaut. Les types generes la declarent optionnelle, pas nullable.
  const genererAttestations = useCallback(async (confirmation?: number) => {
    setGenererEnCours(true);
    setGenererErreur(null);
    const { error } = await supabase.rpc(
      "generer_attestations_gratuites_manquantes",
      confirmation === undefined ? {} : { p_confirmation: confirmation },
    );
    setGenererEnCours(false);
    if (error) {
      setGenererErreur(error.message);
      return error.message;
    }
    void load();
    return null;
  }, [load, supabase]);

  const lancerRattrapage = useCallback(() => {
    if (attestationsEligibles > SEUIL_RATTRAPAGE) {
      setConfirmRattrapage(true);
      return;
    }
    void genererAttestations();
  }, [attestationsEligibles, genererAttestations]);

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
    setErreurDocument(null);
    try {
      const url = await signerDocument(id, "original");
      window.open(url, "_blank");
    } catch (e) {
      // Plus de `catch {}` muet ici : `signerDocument` lève déjà avec le motif
      // rendu par l'edge function, et le jeter faisait qu'un clic sans effet
      // était le SEUL retour — indiscernable d'un navigateur qui bloque le
      // pop-up. Le cas devient courant depuis l'inversion du 09/08 : une fiche
      // dont l'envoi du binaire a échoué n'a pas de fichier à signer.
      setErreurDocument(
        e instanceof Error ? e.message : "Le fichier n'a pas pu être récupéré."
      );
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

  /**
   * Marche arrière du constat, réservée à l'admin. La RPC existait depuis le
   * 22/07 sans qu'aucun écran ne l'appelle : une signature cochée par erreur
   * n'avait aucun recours.
   */
  const retirerSignature = async (): Promise<string | null> => {
    if (!retrait) return "Aucune signature sélectionnée.";
    const { error } = await supabase.rpc("annuler_signature_attestation", {
      p_id: retrait.att.id,
      p_signature: retrait.signature,
    });
    if (error) return error.message;
    void load();
    return null;
  };

  const retirerSignatureAttrib = async (): Promise<string | null> => {
    if (!retraitAttrib) return "Aucune signature sélectionnée.";
    const { error } = await supabase.rpc("annuler_signature_attestation_attribution_lot", {
      p_id: retraitAttrib.att.id,
      p_signature: retraitAttrib.signature,
    });
    if (error) return error.message;
    void load();
    return null;
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

  /** Révoquer une Attestation d'Attribution de Lot — même doctrine que revoquer(). */
  const revoquerAttrib = async (id: string, motif: string): Promise<string | null> => {
    const { error } = await supabase.rpc("revoquer_attestation_attribution_lot", { p_id: id, p_motif: motif });
    if (error) return error.message;
    void load();
    return null;
  };

  const signerAttestationAttrib = async (att: AttestationRow, signature: string) => {
    setSignatureEnCoursAttrib(`${att.id}:${signature}`);
    setErreurActionAttrib(null);
    const { error } = await supabase.rpc("signer_attestation_attribution_lot", {
      p_id: att.id,
      p_signature: signature,
    });
    setSignatureEnCoursAttrib(null);
    if (error) {
      setErreurActionAttrib(error.message);
      return;
    }
    void load();
  };

  const marquerDelivreeAttrib = async (id: string) => {
    setRemiseStateAttrib((s) => ({ ...s, [id]: "loading" }));
    setErreurActionAttrib(null);
    const { error } = await supabase.rpc("marquer_attestation_attribution_lot_delivree", { p_id: id });
    if (error) {
      setErreurActionAttrib(error.message);
      setRemiseStateAttrib((s) => ({ ...s, [id]: "error" }));
      setTimeout(() => setRemiseStateAttrib((s) => ({ ...s, [id]: "idle" })), 2500);
      return;
    }
    setRemiseStateAttrib((s) => ({ ...s, [id]: "idle" }));
    void load();
  };

  const telechargerAttrib = async (reference: string) => {
    setDlStateAttrib((s) => ({ ...s, [reference]: "loading" }));
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
          body: JSON.stringify({ table: "attestations_attribution_lot", reference }),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.erreur || "Erreur");
      window.open(json.url, "_blank");
      setDlStateAttrib((s) => ({ ...s, [reference]: "idle" }));
    } catch {
      setDlStateAttrib((s) => ({ ...s, [reference]: "error" }));
      setTimeout(() => setDlStateAttrib((s) => ({ ...s, [reference]: "idle" })), 2500);
    }
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { id: "attestations", label: "Attestations", icon: <FileCheck className="h-4 w-4" />, count: attestations.length },
    { id: "attributions", label: "Attributions de lot", icon: <FileSignature className="h-4 w-4" />, count: attributionsLot.length },
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
              onClick={lancerRattrapage}
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

      {chargeErreur && (
        <p role="alert" className="rounded-xl border border-danger/25 bg-danger-subtle px-4 py-2.5 text-sm font-medium text-danger">
          {chargeErreur}
        </p>
      )}

      {genererErreur && (
        <p role="alert" className="rounded-xl border border-danger/25 bg-danger-subtle px-4 py-2.5 text-sm font-medium text-danger">
          Échec de la génération des attestations : {genererErreur}
        </p>
      )}

      {/* Ce qui est bloqué doit se voir, ET dire pourquoi. Sans cette ligne, un
          dossier incomplet se traduirait par des lots qui « n'apparaissent nulle
          part » -- le défaut le plus coûteux à diagnostiquer, parce que rien ne
          le signale. La vue nomme les critères manquants, on les affiche tels
          quels plutôt que de renvoyer l'utilisateur deviner lequel des quatre. */}
      {isAdmin && attestationsBloquees > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-foreground print:hidden">
          <p>
            <strong>{attestationsBloquees}</strong> attestation{attestationsBloquees > 1 ? "s" : ""} ne
            peu{attestationsBloquees > 1 ? "vent" : "t"} pas être générée{attestationsBloquees > 1 ? "s" : ""} :
            le score de confiance du lotissement n&apos;atteint pas 100/100.
          </p>
          {blocagesParLotissement.length > 0 && (
            <ul className="mt-2 space-y-1 text-[13px] text-muted-foreground">
              {blocagesParLotissement.map((b) => (
                <li key={b.lotissement}>
                  <span className="font-medium text-foreground">{b.lotissement}</span>{" "}
                  <span className="tabular-nums">({b.score}/100)</span> — manque : {b.manques.join(", ")}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[13px] text-muted-foreground">
            Complétez le dossier depuis l&apos;écran Lotissements, ou accordez-y une dérogation.
          </p>
        </div>
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
              onSigner={actionsAttestation.signatures.length > 0 ? signerAttestation : undefined}
              onRetirer={isAdmin ? (att, signature) => setRetrait({ att, signature }) : undefined}
              signaturesAutorisees={actionsAttestation.signatures}
              signatureEnCours={signatureEnCours}
              erreurAction={erreurAction}
              chargeErreur={chargeErreur}
              onDownload={telecharger}
              onShowQr={setQrAtt}
              onMarquerDelivree={marquerDelivree}
            />
          ) : activeTab === "attributions" ? (
            <AttributionsTab
              rows={attributionsLot}
              dlState={dlStateAttrib}
              remiseState={remiseStateAttrib}
              onRevoquer={isAdmin ? setARevoquerAttrib : undefined}
              onSigner={actionsAttestation.signatures.length > 0 ? signerAttestationAttrib : undefined}
              onRetirer={isAdmin ? (att, signature) => setRetraitAttrib({ att, signature }) : undefined}
              signaturesAutorisees={actionsAttestation.signatures}
              signatureEnCours={signatureEnCoursAttrib}
              erreurAction={erreurActionAttrib}
              chargeErreur={chargeErreur}
              onDownload={telechargerAttrib}
              onShowQr={setQrAttrib}
              onMarquerDelivree={marquerDelivreeAttrib}
            />
          ) : activeTab === "pv" ? (
            <PvTab rows={pvs} chargeErreur={chargeErreur} />
          ) : (
            <DocumentsTab
              rows={docs}
              apercuUrls={apercuUrls}
              dlOriginal={telechargerOriginalPlan}
              erreurAction={erreurDocument}
              chargeLe={chargeLe}
              onOpenLightbox={setLightbox}
              chargeErreur={chargeErreur}
            />
          )}
        </Card>
      </motion.div>

      {qrAtt && <QrModal att={qrAtt} onClose={() => setQrAtt(null)} />}
      {qrAttrib && <QrModal att={qrAttrib} onClose={() => setQrAttrib(null)} />}

      {aRevoquer && (
        <RevocationModal
          att={aRevoquer}
          onClose={() => setARevoquer(null)}
          onConfirm={(motif) => revoquer(aRevoquer.id, motif)}
        />
      )}

      {aRevoquerAttrib && (
        <RevocationModal
          att={aRevoquerAttrib}
          onClose={() => setARevoquerAttrib(null)}
          onConfirm={(motif) => revoquerAttrib(aRevoquerAttrib.id, motif)}
        />
      )}

      {retrait && (
        <RetraitSignatureModal
          att={retrait.att}
          signature={retrait.signature}
          onClose={() => setRetrait(null)}
          onConfirm={retirerSignature}
        />
      )}

      {retraitAttrib && (
        <RetraitSignatureModal
          att={retraitAttrib.att}
          signature={retraitAttrib.signature}
          onClose={() => setRetraitAttrib(null)}
          onConfirm={retirerSignatureAttrib}
        />
      )}

      {confirmRattrapage && (
        <RattrapageModal
          nombre={attestationsEligibles}
          onClose={() => setConfirmRattrapage(false)}
          onConfirm={() => genererAttestations(attestationsEligibles)}
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
