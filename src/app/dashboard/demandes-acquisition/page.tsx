"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ClipboardCheck,
  Coins,
  FileCheck2,
  HandCoins,
  Landmark,
  Loader2,
  MapPin,
  MessageSquare,
  Phone,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useProfile } from "@/hooks/useProfile";

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

const STATUT_META: Record<string, { label: string; cls: string }> = {
  nouvelle: { label: "Nouvelle", cls: "bg-[#0D3B66]/10 text-[#0D3B66]" },
  en_discussion: { label: "En discussion", cls: "bg-[#F39C12]/10 text-[#F39C12]" },
  accord: { label: "Accord de principe", cls: "bg-[#2D8F5A]/10 text-[#2D8F5A]" },
  refusee: { label: "Non retenue", cls: "bg-[#EF4444]/10 text-[#EF4444]" },
  annulee: { label: "Annulée", cls: "bg-slate-100 text-slate-500" },
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
function phaseBadge(d: DemandeAgence): { label: string; cls: string } {
  if (d.statut === "convertie") {
    if (d.attestation_reference) return { label: "Attestation émise", cls: "bg-[#2D8F5A]/15 text-[#2D8F5A]" };
    if (d.vente_statut === "soldee") return { label: "Vendu — certificat émis", cls: "bg-[#2D8F5A]/10 text-[#2D8F5A]" };
    return { label: "Vente en cours", cls: "bg-[#F39C12]/10 text-[#F39C12]" };
  }
  return STATUT_META[d.statut] ?? { label: d.statut, cls: "bg-slate-100 text-slate-500" };
}

export default function DemandesAcquisitionPage() {
  const supabase = useMemo(() => createClient(), []);
  const { profile } = useProfile();
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
  const shown = demandes.filter((d) => (filter === "ouvertes" ? enCours(d) : true));
  const nbOuvertes = demandes.filter(enCours).length;

  return (
    <div className="mx-auto max-w-5xl">
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

      <div className="mb-6">
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-brand-primary sm:text-3xl">
          <ClipboardCheck className="h-6 w-6 text-[#0D3B66]" />
          Demandes d&apos;acquisition
        </h1>
        <p className="mt-1.5 text-sm text-slate-500 sm:text-base">
          Les acquéreurs engagés sur un lot vérifié. Faites évoluer le statut, créez la vente, encaissez le
          prix du lot (certificat automatique au solde), puis facturez l&apos;attestation de cession.
        </p>
      </div>

      {flash && (
        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2D8F5A]" />
          <span>{flash}</span>
        </div>
      )}
      {error && (
        <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/5 px-4 py-3 text-sm text-[#EF4444]">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <Chip active={filter === "ouvertes"} onClick={() => setFilter("ouvertes")}>
          En cours ({nbOuvertes})
        </Chip>
        <Chip active={filter === "toutes"} onClick={() => setFilter("toutes")}>
          Toutes ({demandes.length})
        </Chip>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200/60 bg-white px-5 py-10 text-center text-sm text-slate-500">
          Chargement…
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-xl border border-slate-200/60 bg-white px-5 py-10 text-center text-sm text-slate-500">
          Aucune demande {filter === "ouvertes" ? "en cours" : ""}.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {shown.map((d) => {
            const meta = phaseBadge(d);
            const ouverte = OUVERTES.includes(d.statut);
            const venteSoldee = d.vente_statut === "soldee";
            const attestationEmise = !!d.attestation_reference;
            return (
              <div key={d.id} className="rounded-xl border border-slate-200/60 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="flex items-center gap-1.5 text-base font-semibold text-slate-800">
                      <Landmark className="h-4 w-4 text-[#0D3B66]" />
                      {d.lotissement ?? "—"} — Îlot {d.ilot_numero ?? "?"} · Lot {d.numero_lot ?? "?"}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                      <MapPin className="h-3 w-3" />
                      {[d.village, d.commune].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${meta.cls}`}>
                    {meta.label}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Fact label="Acquéreur">{d.acquereur_nom ?? d.demandeur_nom_complet ?? "—"}</Fact>
                  <Fact label="Téléphone">
                    {d.acquereur_telephone ? (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3 w-3 text-slate-400" />
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
                  <div className="mt-3 rounded-lg border border-slate-200/60 bg-slate-50/60 px-3 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                        <Coins className="h-3.5 w-3.5 text-[#9C6406]" />
                        Vente {d.vente_type === "echelonne" ? "échelonnée" : "au comptant"}
                      </span>
                      <span className="text-slate-500">
                        Payé {fcfa(d.vente_montant_paye)} / {fcfa(d.vente_prix_total)}
                        {!venteSoldee && d.vente_solde != null && ` · reste ${fcfa(d.vente_solde)}`}
                      </span>
                    </div>
                    {d.certificat_reference && (
                      <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#2D8F5A]">
                        <FileCheck2 className="h-3.5 w-3.5" />
                        Certificat de vente {d.certificat_reference}
                        <a
                          href={`/verifier?ref=${encodeURIComponent(d.certificat_reference)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-1 font-medium text-[#0D3B66] underline decoration-dotted hover:no-underline"
                        >
                          Vérifier
                        </a>
                      </p>
                    )}
                  </div>
                )}

                {d.message && !d.vente_id && (
                  <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
                    « {d.message} »
                  </p>
                )}
                {d.note_agence && (
                  <p className="mt-2 text-xs text-slate-400">Note agence : {d.note_agence}</p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <span className="mr-auto text-[11px] text-slate-400">Reçue le {fmtDate(d.cree_le)}</span>
                  <Link
                    href="/dashboard/messages"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-[#0D3B66]" />
                    Échanger
                  </Link>

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
                      <button
                        type="button"
                        onClick={() => setVente(d)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D3B66] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#0a2f52]"
                      >
                        <Coins className="h-3.5 w-3.5" />
                        Créer la vente
                      </button>
                    </>
                  )}

                  {/* Phase 2 — vente créée, pas encore soldée : encaisser le lot */}
                  {d.statut === "convertie" && !venteSoldee && peutAgir && (
                    <button
                      type="button"
                      onClick={() => void encaisserLot(d)}
                      disabled={busy === d.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#9C6406] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#7d5005] disabled:opacity-60"
                    >
                      {busy === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HandCoins className="h-3.5 w-3.5" />}
                      {d.vente_paiement_id ? "Encaisser le lot (guichet)" : "Encaisser la prochaine échéance"}
                      {d.vente_paiement_montant ? ` · ${fcfa(d.vente_paiement_montant)}` : ""}
                    </button>
                  )}
                  {d.statut === "convertie" && !venteSoldee && d.vente_paiement_statut &&
                    ["en_attente", "initie"].includes(d.vente_paiement_statut) && (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D3B66]/5 px-2.5 py-1.5 text-[11px] font-medium text-[#0D3B66]">
                        L&apos;acquéreur peut aussi régler en ligne
                      </span>
                    )}

                  {/* Phase 3 — vente soldée : facturer / encaisser l'attestation */}
                  {d.statut === "convertie" && venteSoldee && !attestationEmise && (
                    !d.cession_id ? (
                      peutAgir && (
                        <button
                          type="button"
                          onClick={() => void facturer(d)}
                          disabled={busy === d.id}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D3B66] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#0a2f52] disabled:opacity-60"
                        >
                          {busy === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScrollText className="h-3.5 w-3.5" />}
                          Facturer l&apos;attestation
                        </button>
                      )
                    ) : peutAgir ? (
                      <button
                        type="button"
                        onClick={() => void encaisserAttestation(d)}
                        disabled={busy === d.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#2D8F5A] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#24794c] disabled:opacity-60"
                      >
                        {busy === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <HandCoins className="h-3.5 w-3.5" />}
                        Encaisser l&apos;attestation (guichet)
                        {d.paiement_montant ? ` · ${fcfa(d.paiement_montant)}` : ""}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#F39C12]/10 px-3 py-1.5 text-xs font-semibold text-[#F39C12]">
                        Attestation en attente de paiement
                      </span>
                    )
                  )}

                  {attestationEmise && (
                    <>
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#2D8F5A]/40 bg-[#2D8F5A]/5 px-3 py-1.5 text-xs font-semibold text-[#2D8F5A]">
                        <ScrollText className="h-3.5 w-3.5" />
                        Attestation {d.attestation_reference}
                      </span>
                      <a
                        href={`/verifier?ref=${encodeURIComponent(d.attestation_reference!)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#0D3B66]/30 px-3 py-1.5 text-xs font-semibold text-[#0D3B66] hover:bg-[#0D3B66]/5"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Vérifier
                      </a>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200/60 px-6 py-4">
          <div>
            <h2 className="flex items-center gap-1.5 text-base font-bold text-[#0D3B66]">
              <Coins className="h-4 w-4" />
              Créer la vente du lot
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {demande.lotissement} — Lot {demande.numero_lot} · Acquéreur : {demande.acquereur_nom ?? "—"}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
            Le prix du lot revient au <span className="font-semibold">propriétaire actuel</span> (le vendeur).
            Au paiement intégral, le <span className="font-semibold">Certificat de vente</span> est émis et la
            propriété bascule à l&apos;acquéreur. L&apos;attestation de cession (Chefferie + Commission SGNF)
            se facture ensuite, séparément.
          </p>

          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Prix de vente (FCFA)
            </label>
            <input
              inputMode="numeric"
              value={prix}
              onChange={(e) => setPrix(e.target.value)}
              placeholder="Ex. 5 000 000"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#0D3B66] focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Modalité
            </label>
            <div className="flex gap-2">
              {(["comptant", "echelonne"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                    type === t
                      ? "border-[#0D3B66] bg-[#0D3B66]/5 text-[#0D3B66]"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {t === "comptant" ? "Au comptant" : "Échelonné"}
                </button>
              ))}
            </div>
          </div>

          {type === "echelonne" && (
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Nombre d&apos;échéances (mensuelles)
              </label>
              <input
                inputMode="numeric"
                value={nbEcheances}
                onChange={(e) => setNbEcheances(e.target.value.replace(/[^\d]/g, ""))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#0D3B66] focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Le certificat n&apos;est émis qu&apos;au règlement de la dernière échéance.
              </p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Moyen de règlement (1re échéance)
            </label>
            <select
              value={moyen}
              onChange={(e) => setMoyen(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#0D3B66] focus:outline-none"
            >
              {MOYENS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-slate-400">
              <span className="font-semibold">Espèces / Virement</span> → encaissement au guichet ici même.{" "}
              <span className="font-semibold">Mobile money</span> → l&apos;acquéreur règle en ligne.
            </p>
          </div>

          {err && (
            <p className="flex items-start gap-1.5 rounded-lg bg-[#EF4444]/5 px-3 py-2 text-xs text-[#EF4444]">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {err}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-200/60 px-6 py-4 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-70 sm:flex-1"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting || !valide}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0D3B66] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0a2f52] disabled:opacity-50 sm:flex-[2]"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
            {submitting ? "Création…" : "Créer la vente"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200/60 bg-slate-50/60 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-800">{children}</p>
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
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
        danger
          ? "border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/5"
          : "border-[#0D3B66]/30 text-[#0D3B66] hover:bg-[#0D3B66]/5"
      }`}
    >
      {children}
    </button>
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
          ? "border-[#0D3B66] bg-[#0D3B66] text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
      }`}
    >
      {children}
    </button>
  );
}
