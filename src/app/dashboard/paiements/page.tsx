"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/utils/supabase/client";
import {
  Banknote, Clock, CreditCard, Plus, Receipt, TrendingUp, X,
} from "lucide-react";

type PaiementRecord = {
  id: string;
  type: string | null;
  montant_total: number | null;
  commission_sgfn: number | null;
  beneficiaire: string | null;
  moyen: string | null;
  statut: string | null;
  cree_le: string | null;
  acquereur_id: string | null;
  reference_externe: string | null;
  attributaires?: { nom: string | null } | null;
};

type Groupe = "admin" | "operateur" | "acquereur" | "verificateur" | "geometre" | "commissaire" | "amenageur" | "chefferie" | "proprietaire" | "agent_ia";

const STATUT_CONFIG: Record<string, { badge: "disponible" | "attribue" | "en_validation" | "litige"; label: string }> = {
  confirme:   { badge: "attribue",     label: "Confirmé" },
  en_attente: { badge: "en_validation", label: "En attente" },
  echoue:     { badge: "litige",       label: "Échoué" },
  rembourse:  { badge: "disponible",   label: "Remboursé" },
};

const TYPE_OPTIONS = [
  { value: "attestation_cession", label: "Attestation de cession" },
  { value: "honoraires",          label: "Honoraires géomètre" },
  { value: "vente_terrain",       label: "Vente terrain" },
  { value: "autre",               label: "Autre" },
];

const MOYEN_OPTIONS = [
  { value: "wave",         label: "Wave" },
  { value: "orange_money", label: "Orange Money" },
  { value: "mtn_money",    label: "MTN Money" },
  { value: "moov_money",   label: "Moov Money" },
  { value: "virement",     label: "Virement bancaire" },
  { value: "especes",      label: "Espèces" },
  { value: "autre",        label: "Autre" },
];

const TYPE_LABELS: Record<string, string> = Object.fromEntries(TYPE_OPTIONS.map((o) => [o.value, o.label]));
const MOYEN_LABELS: Record<string, string> = Object.fromEntries(MOYEN_OPTIONS.map((o) => [o.value, o.label]));

const TABLE_HEADERS = ["Réf.", "Bénéficiaire", "Type", "Montant", "Moyen", "Statut", "Date", ""] as const;

const fcfa = (n: number | null) =>
  `${new Intl.NumberFormat("fr-FR").format(Math.round(n ?? 0))} FCFA`;

// ── Modale Nouveau Paiement ──────────────────────────────────────────────────

type NouveauPaiementModalProps = {
  onClose: () => void;
  onCreated: () => void;
};

function NouveauPaiementModal({ onClose, onCreated }: NouveauPaiementModalProps) {
  const supabase = createClient();
  const [form, setForm] = useState({
    type: "attestation_cession",
    montant_total: "",
    commission_sgfn: "10000",
    beneficiaire: "",
    moyen: "especes",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr("");

    const montant = parseFloat(form.montant_total);
    if (isNaN(montant) || montant <= 0) {
      setErr("Montant invalide.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("paiements").insert({
      type: form.type as never,
      montant_total: montant,
      commission_sgfn: parseFloat(form.commission_sgfn) || 10000,
      beneficiaire: form.beneficiaire || null,
      moyen: form.moyen as never,
      statut: "en_attente",
    });

    if (error) {
      setErr("Erreur lors de la création : " + error.message);
      setSaving(false);
      return;
    }

    onCreated();
    onClose();
  };

  const field = (
    label: string,
    key: keyof typeof form,
    type: string = "text",
    placeholder?: string
  ) => (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-[#0D3B66] focus:outline-none focus:ring-1 focus:ring-[#0D3B66]"
      />
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200/60 px-6 py-4">
          <h2 className="text-base font-bold text-[#0D3B66]">Nouveau paiement</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          {/* Type */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-[#0D3B66] focus:outline-none focus:ring-1 focus:ring-[#0D3B66]"
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {field("Montant total (FCFA)", "montant_total", "number", "Ex : 250000")}
          {field("Commission SGFN (FCFA)", "commission_sgfn", "number", "10000")}
          {field("Bénéficiaire", "beneficiaire", "text", "Nom complet")}

          {/* Moyen */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Moyen de paiement</label>
            <select
              value={form.moyen}
              onChange={(e) => setForm((f) => ({ ...f, moyen: e.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-[#0D3B66] focus:outline-none focus:ring-1 focus:ring-[#0D3B66]"
            >
              {MOYEN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-[#0D3B66] py-2.5 text-sm font-semibold text-white hover:bg-[#1E6091] disabled:opacity-60"
            >
              {saving ? "Enregistrement…" : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page principale ──────────────────────────────────────────────────────────

export default function PaiementsPage() {
  const supabase = createClient();

  const [paiements, setPaiements] = useState<PaiementRecord[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [groupe, setGroupe] = useState<Groupe | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  const canCreate = groupe === "admin" || groupe === "operateur";

  const loadPaiements = async () => {
    setDataLoading(true);
    const { data } = await supabase
      .from("paiements")
      .select("id, type, montant_total, commission_sgfn, beneficiaire, moyen, statut, cree_le, acquereur_id, reference_externe, attributaires(nom)")
      .order("cree_le", { ascending: false });
    setPaiements((data ?? []) as unknown as PaiementRecord[]);
    setDataLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("groupe")
        .eq("id", user.id)
        .single();
      if (profile) setGroupe(profile.groupe as Groupe);

      await loadPaiements();
    };
    void init();
  }, []);

  const handlePayer = async (p: PaiementRecord) => {
    setPayingId(p.id);
    setPayError(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setPayingId(null); return; }

    const res = await supabase.functions.invoke("initier-paiement", {
      body: { paiement_id: p.id },
    });

    if (res.error || res.data?.error) {
      setPayError(res.data?.error ?? "Erreur lors de l'initialisation du paiement.");
      setPayingId(null);
      return;
    }

    // Redirection vers CinetPay
    window.location.href = res.data.payment_url;
  };

  const confirmes = paiements.filter((p) => p.statut === "confirme");
  const totalEncaisse = confirmes.reduce((s, p) => s + (p.montant_total ?? 0), 0);
  const totalCommission = confirmes.reduce((s, p) => s + (p.commission_sgfn ?? 0), 0);
  const enAttente = paiements.filter((p) => p.statut === "en_attente").length;

  return (
    <div className="mx-auto max-w-6xl">
      {showModal && (
        <NouveauPaiementModal
          onClose={() => setShowModal(false)}
          onCreated={() => void loadPaiements()}
        />
      )}

      {/* En-tête */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-primary">
            Suivi des Paiements
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Traçabilité des transactions, honoraires et commissions de la plateforme.{" "}
            <span className={enAttente > 0 ? "font-medium text-[#F39C12]" : "font-medium text-[#2D8F5A]"}>
              {enAttente} en attente.
            </span>
          </p>
        </div>

        {canCreate && (
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#0D3B66] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1E6091]"
          >
            <Plus className="h-4 w-4" />
            Nouveau paiement
          </button>
        )}
      </div>

      {payError && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <X className="h-4 w-4 shrink-0" />
          {payError}
          <button onClick={() => setPayError(null)} className="ml-auto font-medium underline">
            Fermer
          </button>
        </div>
      )}

      {/* KPI */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Total encaissé",       value: fcfa(totalEncaisse),    icon: <Banknote   className="h-4 w-4 text-[#2D8F5A]" /> },
          { label: "Commission SGFN",      value: fcfa(totalCommission),  icon: <TrendingUp className="h-4 w-4 text-[#0D3B66]" /> },
          { label: "Paiements en attente", value: String(enAttente),      icon: <Clock      className="h-4 w-4 text-[#F39C12]" /> },
        ].map((metric) => (
          <div key={metric.label} className="rounded-xl border border-slate-200/60 bg-white px-5 py-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{metric.label}</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F8FAFC]">
                {metric.icon}
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-[#0D3B66]">
              {dataLoading ? "…" : metric.value}
            </p>
          </div>
        ))}
      </div>

      {/* Tableau */}
      <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white">
        <div className="border-b border-slate-200/60 bg-slate-50/50 px-5 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Registre des transactions
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200/60 bg-slate-50/50">
                {TABLE_HEADERS.map((header) => (
                  <th
                    key={header}
                    scope="col"
                    className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60">
              {dataLoading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-500">
                    Chargement des paiements…
                  </td>
                </tr>
              ) : paiements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <Receipt className="h-6 w-6 text-slate-300" />
                      Aucun paiement enregistré.
                    </div>
                  </td>
                </tr>
              ) : (
                paiements.map((p) => {
                  const cfg = STATUT_CONFIG[p.statut ?? "en_attente"] ?? STATUT_CONFIG.en_attente;
                  const canPay =
                    p.statut === "en_attente" &&
                    (p.acquereur_id === currentUserId || groupe === "admin" || groupe === "operateur");

                  return (
                    <tr key={p.id} className="transition-colors hover:bg-slate-50/60">
                      <td className="px-5 py-4 font-mono text-xs font-medium text-[#0D3B66]">
                        {p.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="max-w-[180px] truncate px-5 py-4 text-sm text-slate-700">
                        {p.beneficiaire || (p.attributaires as { nom: string | null } | null)?.nom || "—"}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {TYPE_LABELS[p.type ?? ""] ?? p.type ?? "—"}
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold tabular-nums text-slate-800">
                        {fcfa(p.montant_total)}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {MOYEN_LABELS[p.moyen ?? ""] ?? p.moyen ?? "—"}
                      </td>
                      <td className="px-5 py-4">
                        <Badge status={cfg.badge}>{cfg.label}</Badge>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-500">
                        {p.cree_le
                          ? new Date(p.cree_le).toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="px-5 py-4">
                        {canPay && (
                          <button
                            onClick={() => void handlePayer(p)}
                            disabled={payingId === p.id}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D3B66] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1E6091] disabled:opacity-60"
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            {payingId === p.id ? "…" : "Payer"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info agrégateur */}
      <p className="mt-4 text-center text-xs text-slate-400">
        Paiements en ligne sécurisés via{" "}
        <span className="font-semibold text-slate-500">CinetPay</span> —
        Wave · Orange Money · MTN Money · Moov Money · Visa / Mastercard
      </p>
    </div>
  );
}
