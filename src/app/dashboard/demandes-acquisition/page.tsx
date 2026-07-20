"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Coins,
  FileCheck2,
  HandCoins,
  Landmark,
  MapPin,
  MessageSquare,
  Phone,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import { AppShell } from "@/components/pilotage/AppShell";
import { Badge } from "@/components/ds/badge";
import { Button } from "@/components/ds/button";
import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ds/dialog";
import { Field } from "@/components/ds/label";
import { Input } from "@/components/ds/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ds/select";
import { createClient } from "@/utils/supabase/client";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { useProfile } from "@/hooks/useProfile";
import { actionAgenceRequise, libelleActionAgence } from "@/lib/agence-actions";

/**
 * File des demandes d'acquisition (agence) — pilotage du TUNNEL de vente réelle.
 * Chaque demande émane d'un acquéreur qui a « engagé l'acquisition » d'un lot
 * vérifié. L'agence fait évoluer le statut (en discussion / accord / non retenue)
 * puis déroule le parcours en trois phases :
 *   1. « Créer la vente » (prix, comptant/échelonné) — creer_vente.
 *   2. Encaisser le prix du LOT (guichet) ou attendre le paiement en ligne de
 *      l'acquéreur. Au solde, le Certificat de vente est émis et la propriété
 *      bascule automatiquement.
 *   3. « Facturer l'attestation » de cession (UNIQUEMENT après la vente soldée),
 *      puis l'encaisser — l'attestation (Chefferie + Commission SGNF) est générée.
 */

type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

type DemandeAgence = {
  id: string;
  lot_id: string;
  vente_id: string | null;
  cession_id: string | null;
  demandeur_nom_complet: string | null;
  acquereur_nom: string | null;
  acquereur_telephone: string | null;
  montant_propose: number | null;
  message: string | null;
  statut: string;
  note_agence: string | null;
  cree_le: string | null;
  maj_le: string | null;
  numero_lot: string | null;
  ilot_numero: string | null;
  lotissement: string | null;
  village: string | null;
  commune: string | null;
  // Vente
  vente_statut: string | null;
  vente_type: string | null;
  vente_prix_total: number | null;
  vente_montant_paye: number | null;
  vente_solde: number | null;
  certificat_reference: string | null;
  certificat_qr_token: string | null;
  vente_paiement_id: string | null;
  vente_paiement_statut: string | null;
  vente_paiement_montant: number | null;
  // Attestation (post-vente)
  paiement_statut: string | null;
  paiement_montant: number | null;
  attestation_reference: string | null;
  attestation_qr_token: string | null;
};

const STATUT_META: Record<string, { label: string; tone: BadgeTone }> = {
  nouvelle: { label: "Nouvelle", tone: "accent" },
  en_discussion: { label: "En discussion", tone: "warning" },
  accord: { label: "Accord de principe", tone: "success" },
  refusee: { label: "Non retenue", tone: "danger" },
  annulee: { label: "Annulée", tone: "neutral" },
};

const MOYENS: { value: string; label: string }[] = [
  { value: "especes", label: "Espèces (guichet)" },
  { value: "virement", label: "Virement" },
  { value: "wave", label: "Wave" },
  { value: "orange_money", label: "Orange Money" },
  { value: "mtn_money", label: "MTN Money" },
  { value: "moov_money", label: "Moov Money" },
  { value: "autre", label: "Autre" },
];

const fcfa = (n: number | null | undefined) =>
  n == null ? "—" : `${new Intl.NumberFormat("fr-FR").format(n)} FCFA`;

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—";

const OUVERTES = ["nouvelle", "en_discussion", "accord"];

// Badge de phase : au statut 'convertie', on reflète l'avancée réelle (vente en
// cours / soldée / attestation) plutôt que le simple libellé d'enum.
function phaseBadge(d: DemandeAgence): { label: string; tone: BadgeTone } {
  if (d.statut === "convertie") {
    if (d.attestation_reference) return { label: "Attestation émise", tone: "success" };
    if (d.vente_statut === "soldee") return { label: "Vendu — certificat émis", tone: "success" };
    return { label: "Vente en cours", tone: "warning" };
  }
  return STATUT_META[d.statut] ?? { label: d.statut, tone: "neutral" };
}

export default function DemandesAcquisitionPage() {
  const supabase = useMemo(() => createClient(), []);
  const { profile } = useProfile();
  const { counts } = useBadgeCounts();
  const peutAgir = profile?.groupe === "admin" || profile?.groupe === "operateur";

  const [demandes, setDemandes] = useState<DemandeAgence[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ouvertes" | "toutes">("ouvertes");
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vente, setVente] = useState<DemandeAgence | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("demandes_acquisition_agence")
      .select("*")
      .order("cree_le", { ascending: false });
    setDemandes((data ?? []) as DemandeAgence[]);
    setLoading(false);
    // Met à jour le badge rouge du menu immédiatement après une action.
    if (typeof window !== "undefined") window.dispatchEvent(new Event("sgnf:refresh-badges"));
  }, [supabase]);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("demandes_acquisition_agence")
        .select("*")
        .order("cree_le", { ascending: false });
      setDemandes((data ?? []) as DemandeAgence[]);
      setLoading(false);
    })();
  }, [supabase]);

  const majStatut = async (d: DemandeAgence, statut: string) => {
    setBusy(d.id);
    setError(null);
    const { error: e } = await supabase.rpc("maj_statut_demande_acquisition", {
      p_demande_id: d.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      p_statut: statut as any,
    });
    setBusy(null);
    if (e) {
      setError(e.message);
      return;
    }
    await load();
  };

  // Encaissement GUICHET du prix du lot. Pour l'échelonné, si aucune échéance
  // n'est en attente, on crée d'abord la prochaine puis on l'encaisse.
  const encaisserLot = async (d: DemandeAgence) => {
    setBusy(d.id);
    setError(null);
    if (!d.vente_paiement_id && d.vente_id) {
      const { error: eEch } = await supabase.rpc("creer_paiement_echeance_suivante", {
        p_vente_id: d.vente_id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        p_moyen: "especes" as any,
      });
      if (eEch) {
        setBusy(null);
        setError(eEch.message);
        return;
      }
    }
    const { data, error: e } = await supabase.rpc("encaisser_vente_guichet", { p_demande_id: d.id });
    setBusy(null);
    if (e) {
      setError(e.message);
      return;
    }
    const r = (data ?? {}) as { vente_soldee?: boolean; montant?: number };
    setFlash(
      r.vente_soldee
        ? `Paiement du lot encaissé (${fcfa(r.montant)}). Vente soldée : le Certificat de vente est émis et la propriété a basculé à l'acquéreur. Vous pouvez maintenant facturer l'attestation de cession.`
        : `Échéance encaissée (${fcfa(r.montant)}). Il reste des échéances avant le solde total.`
    );
    await load();
  };

  // Facturation de l'attestation de cession (post-solde).
  const facturer = async (d: DemandeAgence) => {
    setBusy(d.id);
    setError(null);
    const { data, error: e } = await supabase.rpc("facturer_attestation_demande", { p_demande_id: d.id });
    setBusy(null);
    if (e) {
      setError(e.message);
      return;
    }
    const r = (data ?? {}) as { rang?: number; montant_total?: number; statut_paiement?: string };
    setFlash(
      `Attestation de cession facturée (${r.rang ?? "?"}e attestation — ${fcfa(r.montant_total)}). ` +
        (r.statut_paiement === "en_attente_validation"
          ? "À encaisser au guichet ci-dessous pour générer l'attestation."
          : "L'acquéreur la règle en ligne ; l'attestation est émise à la confirmation.")
    );
    await load();
  };

  // Encaissement GUICHET de l'attestation → génération (RPC réutilisée du tunnel).
  const encaisserAttestation = async (d: DemandeAgence) => {
    setBusy(d.id);
    setError(null);
    const { data, error: e } = await supabase.rpc("encaisser_demande_acquisition", { p_demande_id: d.id });
    setBusy(null);
    if (e) {
      setError(e.message);
      return;
    }
    const r = (data ?? {}) as { attestation_reference?: string; montant?: number };
    setFlash(
      `Attestation encaissée (${fcfa(r.montant)}) — attestation ${r.attestation_reference ?? ""} générée. ` +
        `La quittance et l'attestation PDF sont en cours de production.`
    );
    await load();
  };

  // « En cours » = tout ce qui attend une action de l'agence : demandes ouvertes
  // + ventes converties tant que l'attestation n'est pas émise.
  const enCours = (d: DemandeAgence) =>
    OUVERTES.includes(d.statut) || (d.statut === "convertie" && !d.attestation_reference);
  // Les cartes « à faire » (c'est à nous de jouer) remontent en tête.
  const shown = demandes
    .filter((d) => (filter === "ouvertes" ? enCours(d) : true))
    .sort((a, b) => Number(actionAgenceRequise(b)) - Number(actionAgenceRequise(a)));
  const nbOuvertes = demandes.filter(enCours).length;
  const nbAFaire = demandes.filter(actionAgenceRequise).length;

  return (
    <AppShell loading={loading} counts={counts} onRefresh={load}>
      {vente && (
        <VenteModal
          demande={vente}
          onClose={() => setVente(null)}
          onDone={(msg) => {
            setVente(null);
            setFlash(msg);
            void load();
          }}
        />
      )}

      <div>
        <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">
          Demandes d&apos;acquisition
        </h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          Les acquéreurs engagés sur un lot vérifié. Faites évoluer le statut, créez la vente, encaissez le
          prix du lot (certificat automatique au solde), puis facturez l&apos;attestation de cession.
        </p>
      </div>

      {/* Compteur d'actions à faire — bandeau très visible pour ne rien rater. */}
      {!loading && (
        <div
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
            nbAFaire > 0 ? "border-danger/30 bg-danger-subtle" : "border-success/30 bg-success-subtle"
          }`}
        >
          {nbAFaire > 0 ? (
            <>
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-danger" />
              </span>
              <span className="text-sm font-semibold text-danger">
                {nbAFaire} action{nbAFaire > 1 ? "s" : ""} à faire
              </span>
              <span className="text-sm text-muted-foreground">— traitez les cartes marquées en rouge ci-dessous.</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
              <span className="text-sm font-medium text-success">Tout est à jour — aucune action en attente.</span>
            </>
          )}
        </div>
      )}

      {flash && (
        <div className="flex items-start gap-2.5 rounded-xl border border-success/25 bg-success-subtle px-4 py-3 text-sm text-success">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{flash}</span>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger-subtle px-4 py-3 text-sm text-danger">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Chip active={filter === "ouvertes"} onClick={() => setFilter("ouvertes")}>
          En cours ({nbOuvertes})
        </Chip>
        <Chip active={filter === "toutes"} onClick={() => setFilter("toutes")}>
          Toutes ({demandes.length})
        </Chip>
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground shadow-panel">
          Chargement…
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground shadow-panel">
          Aucune demande {filter === "ouvertes" ? "en cours" : ""}.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {shown.map((d) => {
            const meta = phaseBadge(d);
            const ouverte = OUVERTES.includes(d.statut);
            const venteSoldee = d.vente_statut === "soldee";
            const attestationEmise = !!d.attestation_reference;
            const action = libelleActionAgence(d);
            return (
              <div
                key={d.id}
                className={`rounded-xl border bg-card p-5 shadow-panel ${
                  action ? "border-danger/40 ring-1 ring-danger/20" : "border-border"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="flex items-center gap-1.5 text-base font-semibold text-foreground">
                      <Landmark className="h-4 w-4 text-accent" />
                      {d.lotissement ?? "—"} — Îlot {d.ilot_numero ?? "?"} · Lot {d.numero_lot ?? "?"}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {[d.village, d.commune].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {action && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-danger px-2.5 py-1 text-xs font-bold text-white shadow-panel">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                        </span>
                        À faire : {action}
                      </span>
                    )}
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Fact label="Acquéreur">{d.acquereur_nom ?? d.demandeur_nom_complet ?? "—"}</Fact>
                  <Fact label="Téléphone">
                    {d.acquereur_telephone ? (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3 text-muted-2" />
                        {d.acquereur_telephone}
                      </span>
                    ) : (
                      "—"
                    )}
                  </Fact>
                  <Fact label={d.vente_id ? "Prix de vente" : "Offre proposée"}>
                    {fcfa(d.vente_id ? d.vente_prix_total : d.montant_propose)}
                  </Fact>
                </div>

                {/* Suivi de la vente (dès qu'elle existe) */}
                {d.vente_id && (
                  <div className="mt-3 rounded-lg border border-border bg-inset px-3 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                        <Coins className="h-3.5 w-3.5 text-warning" />
                        Vente {d.vente_type === "echelonne" ? "échelonnée" : "au comptant"}
                      </span>
                      <span className="text-muted-foreground">
                        Payé {fcfa(d.vente_montant_paye)} / {fcfa(d.vente_prix_total)}
                        {!venteSoldee && d.vente_solde != null && ` · reste ${fcfa(d.vente_solde)}`}
                      </span>
                    </div>
                    {d.certificat_reference && (
                      <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-success">
                        <FileCheck2 className="h-3.5 w-3.5" />
                        Certificat de vente {d.certificat_reference}
                        <a
                          href={`/verifier?ref=${encodeURIComponent(d.certificat_reference)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-1 font-medium text-accent underline decoration-dotted hover:no-underline"
                        >
                          Vérifier
                        </a>
                      </p>
                    )}
                  </div>
                )}

                {d.message && !d.vente_id && (
                  <p className="mt-3 rounded-lg bg-inset px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                    « {d.message} »
                  </p>
                )}
                {d.note_agence && (
                  <p className="mt-2 text-xs text-muted-2">Note agence : {d.note_agence}</p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  <span className="mr-auto text-[11px] text-muted-2">Reçue le {fmtDate(d.cree_le)}</span>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/dashboard/messages">
                      <MessageSquare className="h-3.5 w-3.5 text-accent" />
                      Échanger
                    </Link>
                  </Button>

                  {/* Phase 1 — demande ouverte : statuts + créer la vente */}
                  {peutAgir && ouverte && (
                    <>
                      {d.statut !== "en_discussion" && (
                        <ActionBtn onClick={() => void majStatut(d, "en_discussion")} busy={busy === d.id}>
                          En discussion
                        </ActionBtn>
                      )}
                      {d.statut !== "accord" && (
                        <ActionBtn onClick={() => void majStatut(d, "accord")} busy={busy === d.id}>
                          Accord
                        </ActionBtn>
                      )}
                      <ActionBtn onClick={() => void majStatut(d, "refusee")} busy={busy === d.id} danger>
                        Ne pas retenir
                      </ActionBtn>
                      <Button type="button" variant="primary" size="sm" onClick={() => setVente(d)}>
                        <Coins className="h-3.5 w-3.5" />
                        Créer la vente
                      </Button>
                    </>
                  )}

                  {/* Phase 2 — vente créée, pas encore soldée : encaisser le lot */}
                  {d.statut === "convertie" && !venteSoldee && peutAgir && (
                    <Button
                      type="button"
                      variant="accent"
                      size="sm"
                      loading={busy === d.id}
                      onClick={() => void encaisserLot(d)}
                    >
                      {busy === d.id ? null : <HandCoins className="h-3.5 w-3.5" />}
                      {d.vente_paiement_id ? "Encaisser le lot (guichet)" : "Encaisser la prochaine échéance"}
                      {d.vente_paiement_montant ? ` · ${fcfa(d.vente_paiement_montant)}` : ""}
                    </Button>
                  )}
                  {d.statut === "convertie" && !venteSoldee && d.vente_paiement_statut &&
                    ["en_attente", "initie"].includes(d.vente_paiement_statut) && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-accent-subtle px-2.5 py-1.5 text-[11px] font-medium text-accent">
                        L&apos;acquéreur peut aussi régler en ligne
                      </span>
                    )}

                  {/* Phase 3 — vente soldée : facturer / encaisser l'attestation */}
                  {d.statut === "convertie" && venteSoldee && !attestationEmise && (
                    !d.cession_id ? (
                      peutAgir && (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          loading={busy === d.id}
                          onClick={() => void facturer(d)}
                        >
                          {busy === d.id ? null : <ScrollText className="h-3.5 w-3.5" />}
                          Facturer l&apos;attestation
                        </Button>
                      )
                    ) : peutAgir ? (
                      <Button
                        type="button"
                        variant="accent"
                        size="sm"
                        loading={busy === d.id}
                        onClick={() => void encaisserAttestation(d)}
                      >
                        {busy === d.id ? null : <HandCoins className="h-3.5 w-3.5" />}
                        Encaisser l&apos;attestation (guichet)
                        {d.paiement_montant ? ` · ${fcfa(d.paiement_montant)}` : ""}
                      </Button>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-warning-subtle px-3 py-1.5 text-xs font-semibold text-warning">
                        Attestation en attente de paiement
                      </span>
                    )
                  )}

                  {attestationEmise && (
                    <>
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-success/40 bg-success-subtle px-3 py-1.5 text-xs font-semibold text-success">
                        <ScrollText className="h-3.5 w-3.5" />
                        Attestation {d.attestation_reference}
                      </span>
                      <Button asChild variant="outline" size="sm">
                        <a
                          href={`/verifier?ref=${encodeURIComponent(d.attestation_reference!)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Vérifier
                        </a>
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

function VenteModal({
  demande,
  onClose,
  onDone,
}: {
  demande: DemandeAgence;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [prix, setPrix] = useState(demande.montant_propose ? String(demande.montant_propose) : "");
  const [type, setType] = useState<"comptant" | "echelonne">("comptant");
  const [nbEcheances, setNbEcheances] = useState("3");
  const [moyen, setMoyen] = useState("especes");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const prixNum = Number(prix.replace(/[^\d]/g, ""));
  const valide = prixNum > 0 && (type === "comptant" || Number(nbEcheances) >= 2);

  const submit = async () => {
    setSubmitting(true);
    setErr(null);
    const { data, error } = await supabase.rpc("creer_vente", {
      p_demande_id: demande.id,
      p_prix: prixNum,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      p_type_vente: type as any,
      p_nb_echeances: type === "echelonne" ? Number(nbEcheances) : 1,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      p_moyen: moyen as any,
    });
    setSubmitting(false);
    if (error) {
      setErr(error.message);
      return;
    }
    const r = (data ?? {}) as { montant_a_payer?: number; statut_paiement?: string };
    const enLigne = !["especes", "virement"].includes(moyen);
    onDone(
      `Vente créée pour ${demande.acquereur_nom ?? "l'acquéreur"} (${fcfa(prixNum)}${
        type === "echelonne" ? `, ${nbEcheances} échéances` : ", comptant"
      }). ` +
        (enLigne
          ? `L'acquéreur règle le lot en ligne (${fcfa(r.montant_a_payer)}). Le certificat s'émettra au solde.`
          : `Encaissez le paiement du lot au guichet (${fcfa(r.montant_a_payer)}) : le certificat s'émettra au solde.`)
    );
  };

  return (
    <Dialog open onOpenChange={(ouvert) => { if (!ouvert) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <p className="text-[11px] font-bold tracking-[0.18em] text-accent uppercase">Vente du lot</p>
          <DialogTitle>Créer la vente du lot</DialogTitle>
          <DialogDescription>
            {demande.lotissement} — Lot {demande.numero_lot} · Acquéreur : {demande.acquereur_nom ?? "—"}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <p className="rounded-lg bg-inset px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            Le prix du lot revient au <span className="font-semibold text-foreground">propriétaire actuel</span> (le vendeur).
            Au paiement intégral, le <span className="font-semibold text-foreground">Certificat de vente</span> est émis et la
            propriété bascule à l&apos;acquéreur. L&apos;attestation de cession (Chefferie + Commission SGNF)
            se facture ensuite, séparément.
          </p>

          <Field label="Prix de vente (FCFA)" htmlFor="vente-prix">
            <Input
              id="vente-prix"
              inputMode="numeric"
              value={prix}
              onChange={(e) => setPrix(e.target.value)}
              placeholder="Ex. 5 000 000"
            />
          </Field>

          <div className="space-y-1.5">
            <p className="text-[13px] font-semibold text-foreground">Modalité</p>
            <div className="flex gap-2">
              {(["comptant", "echelonne"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 rounded-md border px-3 py-2 text-xs font-semibold transition-colors ${
                    type === t
                      ? "border-accent bg-accent-subtle text-accent"
                      : "border-border text-muted-foreground hover:bg-inset"
                  }`}
                >
                  {t === "comptant" ? "Au comptant" : "Échelonné"}
                </button>
              ))}
            </div>
          </div>

          {type === "echelonne" && (
            <Field
              label="Nombre d'échéances (mensuelles)"
              htmlFor="vente-echeances"
              hint="Le certificat n'est émis qu'au règlement de la dernière échéance."
            >
              <Input
                id="vente-echeances"
                inputMode="numeric"
                value={nbEcheances}
                onChange={(e) => setNbEcheances(e.target.value.replace(/[^\d]/g, ""))}
              />
            </Field>
          )}

          <Field
            label="Moyen de règlement (1re échéance)"
            htmlFor="vente-moyen"
            hint="Espèces / Virement → encaissement au guichet. Mobile money → l'acquéreur règle en ligne."
          >
            <Select value={moyen} onValueChange={setMoyen}>
              <SelectTrigger id="vente-moyen">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOYENS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {err && (
            <p role="alert" className="flex items-start gap-1.5 rounded-lg bg-danger-subtle px-3 py-2 text-xs text-danger">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {err}
            </p>
          )}
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Annuler
          </Button>
          <Button type="button" variant="primary" loading={submitting} disabled={!valide} onClick={() => void submit()}>
            {submitting ? null : <Coins className="h-4 w-4" />}
            {submitting ? "Création…" : "Créer la vente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-inset px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-2">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-foreground">{children}</p>
    </div>
  );
}

function ActionBtn({
  onClick,
  busy,
  danger,
  children,
}: {
  onClick: () => void;
  busy: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={onClick}
      className={danger ? "text-danger hover:bg-danger-subtle hover:text-danger" : undefined}
    >
      {children}
    </Button>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-border-strong"
      }`}
    >
      {children}
    </button>
  );
}
