"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ClipboardCheck,
  HandCoins,
  Handshake,
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
 * File des demandes d'acquisition (agence). Chaque demande émane d'un acquéreur
 * qui a « engagé l'acquisition » d'un lot vérifié. L'agence fait évoluer le
 * statut (en discussion / accord / non retenue) puis, quand c'est acté,
 * « Convertit en cession » : la RPC crée l'attributaire acquéreur et délègue à
 * creer_cession (cession + attribution + paiement d'attestation).
 */

type DemandeAgence = {
  id: string;
  lot_id: string;
  demandeur_nom_complet: string | null;
  acquereur_nom: string | null;
  acquereur_telephone: string | null;
  montant_propose: number | null;
  message: string | null;
  statut: string;
  note_agence: string | null;
  cession_id: string | null;
  cree_le: string | null;
  maj_le: string | null;
  numero_lot: string | null;
  ilot_numero: string | null;
  lotissement: string | null;
  village: string | null;
  commune: string | null;
  paiement_statut: string | null;
  paiement_montant: number | null;
  attestation_reference: string | null;
  attestation_qr_token: string | null;
};

const STATUT_META: Record<string, { label: string; cls: string }> = {
  nouvelle: { label: "Nouvelle", cls: "bg-[#0D3B66]/10 text-[#0D3B66]" },
  en_discussion: { label: "En discussion", cls: "bg-[#F39C12]/10 text-[#F39C12]" },
  accord: { label: "Accord de principe", cls: "bg-[#2D8F5A]/10 text-[#2D8F5A]" },
  convertie: { label: "Convertie en cession", cls: "bg-[#2D8F5A]/15 text-[#2D8F5A]" },
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
  const [convert, setConvert] = useState<DemandeAgence | null>(null);

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

  const encaisser = async (d: DemandeAgence) => {
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
      `Paiement encaissé${r.montant ? ` (${fcfa(r.montant)})` : ""} — attestation ${
        r.attestation_reference ?? ""
      } générée. La quittance et l'attestation PDF sont en cours de production.`
    );
    await load();
  };

  const shown = demandes.filter((d) => (filter === "ouvertes" ? OUVERTES.includes(d.statut) : true));
  const nbOuvertes = demandes.filter((d) => OUVERTES.includes(d.statut)).length;

  return (
    <div className="mx-auto max-w-5xl">
      {convert && (
        <ConvertModal
          demande={convert}
          onClose={() => setConvert(null)}
          onDone={(msg) => {
            setConvert(null);
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
          Les acquéreurs qui se sont engagés sur un lot vérifié. Faites évoluer le statut, puis
          convertissez en cession quand l&apos;accord est acté.
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
            const meta = STATUT_META[d.statut] ?? { label: d.statut, cls: "bg-slate-100 text-slate-500" };
            const ouverte = OUVERTES.includes(d.statut);
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
                  <Fact label="Offre proposée">{fcfa(d.montant_propose)}</Fact>
                </div>

                {d.message && (
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
                        onClick={() => setConvert(d)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D3B66] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#0a2f52]"
                      >
                        <Handshake className="h-3.5 w-3.5" />
                        Convertir en cession
                      </button>
                    </>
                  )}
                  {d.statut === "convertie" &&
                    (d.attestation_reference ? (
                      <>
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#2D8F5A]/40 bg-[#2D8F5A]/5 px-3 py-1.5 text-xs font-semibold text-[#2D8F5A]">
                          <ScrollText className="h-3.5 w-3.5" />
                          Attestation {d.attestation_reference}
                        </span>
                        <a
                          href={`/verifier?ref=${encodeURIComponent(d.attestation_reference)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#0D3B66]/30 px-3 py-1.5 text-xs font-semibold text-[#0D3B66] hover:bg-[#0D3B66]/5"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Vérifier
                        </a>
                      </>
                    ) : peutAgir ? (
                      <button
                        type="button"
                        onClick={() => void encaisser(d)}
                        disabled={busy === d.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#2D8F5A] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#24794c] disabled:opacity-60"
                      >
                        <HandCoins className="h-3.5 w-3.5" />
                        Encaisser &amp; générer l&apos;attestation
                        {d.paiement_montant ? ` · ${fcfa(d.paiement_montant)}` : ""}
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#F39C12]/10 px-3 py-1.5 text-xs font-semibold text-[#F39C12]">
                        Attestation en attente de paiement
                      </span>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ConvertModal({
  demande,
  onClose,
  onDone,
}: {
  demande: DemandeAgence;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [moyen, setMoyen] = useState("especes");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true);
    setErr(null);
    const { data, error } = await supabase.rpc("convertir_demande_en_cession", {
      p_demande_id: demande.id,
      p_date_cession: date || undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      p_moyen: moyen as any,
    });
    setSubmitting(false);
    if (error) {
      setErr(error.message);
      return;
    }
    const r = (data ?? {}) as { rang?: number; montant_total?: number; statut_paiement?: string };
    onDone(
      `Cession créée pour ${demande.acquereur_nom ?? "l'acquéreur"} (${r.rang ?? "?"}e attestation` +
        `${r.montant_total != null ? ` — ${fcfa(r.montant_total)}` : ""}). ` +
        (r.statut_paiement === "en_attente_validation"
          ? "Paiement à valider au guichet (onglet Paiements)."
          : "Paiement en attente de règlement.")
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
              <Handshake className="h-4 w-4" />
              Convertir en cession
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
            L&apos;acquéreur sera enregistré comme attributaire du lot, et une attestation de cession sera
            facturée selon le palier (2e = forfait national, 3e+ = tarif chefferie). Le tarif s&apos;affiche
            après création dans l&apos;onglet Paiements.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Date de cession
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#0D3B66] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Moyen de paiement
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
            </div>
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
            disabled={submitting}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0D3B66] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0a2f52] disabled:opacity-70 sm:flex-[2]"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Handshake className="h-4 w-4" />}
            {submitting ? "Création…" : "Créer la cession"}
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
