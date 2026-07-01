"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { createClient } from "@/utils/supabase/client";
import {
  Banknote, CheckCircle2, Clock, CreditCard, Download, Plus, Receipt, ShieldCheck, TrendingUp, X,
} from "lucide-react";
import {
  MOYEN_OPTIONS, MOYEN_LABELS, STATUT_CONFIG, TYPE_OPTIONS, fcfa, isMoyenManuel, labelTypePaiement,
  type TypePaiement,
} from "@/lib/paiements";

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
  reference: string | null;
  echeance_id: string | null;
  vente_id: string | null;
  attributaires?: { nom: string | null } | null;
  ventes?: { type_vente: string | null } | null;
};

type Groupe = "admin" | "operateur" | "acquereur" | "verificateur" | "geometre" | "commissaire" | "amenageur" | "chefferie" | "proprietaire" | "agent_ia";

const TABLE_HEADERS = ["Réf.", "Bénéficiaire", "Type", "Montant", "Moyen", "Statut", "Date", ""] as const;

// ── Sélecteurs liés par type de paiement ────────────────────────────────────

type AttestationOption = {
  id: string; reference: string; statut: string | null; cession_id: string | null;
  acquereur_id: string; attributaires: { nom: string | null } | null;
};
type DemarcheOption = {
  id: string; type: string | null; description: string | null; montant_honoraires: number | null;
  attributaire_id: string | null; attributaires: { nom: string | null } | null;
};
type VenteOption = {
  id: string; lot_id: string; prix_total: number; solde: number | null; type_vente: string | null;
  acquereur_id: string; attributaires: { nom: string | null } | null;
};
type EcheanceOption = { id: string; numero: number; montant_du: number; date_echeance: string };
type AttributaireOption = { id: string; nom: string };

// ── Modale Nouveau Paiement ──────────────────────────────────────────────────

type NouveauPaiementModalProps = {
  onClose: () => void;
  onCreated: () => void;
};

function NouveauPaiementModal({ onClose, onCreated }: NouveauPaiementModalProps) {
  const supabase = useMemo(() => createClient(), []);
  const [type, setType] = useState<TypePaiement>("attestation_cession");
  const [beneficiaire, setBeneficiaire] = useState("");
  const [montant, setMontant] = useState("");
  const [moyen, setMoyen] = useState("especes");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [attestations, setAttestations] = useState<AttestationOption[]>([]);
  const [demarches, setDemarches] = useState<DemarcheOption[]>([]);
  const [ventes, setVentes] = useState<VenteOption[]>([]);
  const [echeances, setEcheances] = useState<EcheanceOption[]>([]);
  const [attributaires, setAttributaires] = useState<AttributaireOption[]>([]);

  const [attestationId, setAttestationId] = useState("");
  const [demarcheId, setDemarcheId] = useState("");
  const [venteId, setVenteId] = useState("");
  const [echeanceId, setEcheanceId] = useState("");
  const [autreAttributaireId, setAutreAttributaireId] = useState("");

  // Charger les options liées selon le type sélectionné
  useEffect(() => {
    const load = async () => {
      setErr("");
      if (type === "attestation_cession") {
        const { data } = await supabase
          .from("attestations_cession")
          .select("id, reference, statut, cession_id, acquereur_id, attributaires(nom)")
          .neq("statut", "delivree");
        setAttestations((data ?? []) as unknown as AttestationOption[]);
      } else if (type === "honoraires") {
        const { data } = await supabase
          .from("demarches")
          .select("id, type, description, montant_honoraires, attributaire_id, attributaires(nom)")
          .is("terminee_le", null)
          .not("montant_honoraires", "is", null);
        setDemarches((data ?? []) as unknown as DemarcheOption[]);
      } else if (type === "vente_terrain") {
        const { data } = await supabase
          .from("ventes")
          .select("id, lot_id, prix_total, solde, type_vente, acquereur_id, attributaires(nom)")
          .eq("statut", "en_cours");
        setVentes((data ?? []) as unknown as VenteOption[]);
      } else if (type === "autre") {
        const { data } = await supabase
          .from("attributaires")
          .select("id, nom")
          .order("nom", { ascending: true });
        setAttributaires((data ?? []) as AttributaireOption[]);
      }
    };
    void load();
  }, [supabase, type]);

  const venteChoisie = ventes.find((v) => v.id === venteId);

  // Charger les échéances impayées de la vente choisie (vente échelonnée)
  useEffect(() => {
    const load = async () => {
      setEcheanceId("");
      setEcheances([]);
      if (venteChoisie?.type_vente === "echelonne") {
        const { data } = await supabase
          .from("echeances")
          .select("id, numero, montant_du, date_echeance")
          .eq("vente_id", venteChoisie.id)
          .neq("statut", "payee")
          .order("numero");
        setEcheances((data ?? []) as EcheanceOption[]);
      }
    };
    void load();
  }, [supabase, venteChoisie?.id, venteChoisie?.type_vente]);

  // Pré-remplir bénéficiaire / montant quand la sélection change
  useEffect(() => {
    const run = () => {
      if (type === "attestation_cession") {
        const a = attestations.find((x) => x.id === attestationId);
        setBeneficiaire(a?.attributaires?.nom ?? "");
      } else if (type === "honoraires") {
        const d = demarches.find((x) => x.id === demarcheId);
        setBeneficiaire(d?.attributaires?.nom ?? "");
        setMontant(d?.montant_honoraires != null ? String(d.montant_honoraires) : "");
      } else if (type === "vente_terrain") {
        setBeneficiaire(venteChoisie?.attributaires?.nom ?? "");
        const echeance = echeances.find((e) => e.id === echeanceId);
        if (venteChoisie?.type_vente === "echelonne") {
          setMontant(echeance ? String(echeance.montant_du) : "");
        } else {
          setMontant(venteChoisie ? String(venteChoisie.solde ?? venteChoisie.prix_total) : "");
        }
      } else if (type === "autre") {
        const a = attributaires.find((x) => x.id === autreAttributaireId);
        setBeneficiaire(a?.nom ?? "");
      }
    };
    run();
  }, [
    attestationId,
    attestations,
    autreAttributaireId,
    attributaires,
    demarcheId,
    demarches,
    echeanceId,
    echeances,
    type,
    venteChoisie,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");

    const montantNum = parseFloat(montant);
    if (isNaN(montantNum) || montantNum <= 0) {
      setErr("Montant invalide.");
      return;
    }

    const payload: Record<string, unknown> = {
      type,
      montant_total: montantNum,
      beneficiaire: beneficiaire || null,
      moyen,
      statut: isMoyenManuel(moyen) ? "en_attente_validation" : "en_attente",
    };

    if (type === "attestation_cession") {
      const a = attestations.find((x) => x.id === attestationId);
      if (!a) { setErr("Sélectionnez une attestation."); return; }
      payload.cession_id = a.cession_id;
      payload.acquereur_id = a.acquereur_id;
    } else if (type === "honoraires") {
      const d = demarches.find((x) => x.id === demarcheId);
      if (!d) { setErr("Sélectionnez une démarche."); return; }
      payload.demarche_id = d.id;
      payload.acquereur_id = d.attributaire_id;
    } else if (type === "vente_terrain") {
      if (!venteChoisie) { setErr("Sélectionnez une vente."); return; }
      payload.vente_id = venteChoisie.id;
      payload.acquereur_id = venteChoisie.acquereur_id;
      if (venteChoisie.type_vente === "echelonne") {
        if (!echeanceId) { setErr("Sélectionnez une échéance."); return; }
        payload.echeance_id = echeanceId;
      }
    } else if (type === "autre") {
      if (!autreAttributaireId) { setErr("Sélectionnez un attributaire."); return; }
      payload.acquereur_id = autreAttributaireId;
    }

    setSaving(true);
    const { error } = await supabase.from("paiements").insert(payload as never);

    if (error) {
      setErr("Erreur lors de la création : " + error.message);
      setSaving(false);
      return;
    }

    onCreated();
    onClose();
  };

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
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as TypePaiement)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-[#0D3B66] focus:outline-none focus:ring-1 focus:ring-[#0D3B66]"
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {type === "attestation_cession" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Attestation de cession</label>
              <select
                value={attestationId}
                onChange={(e) => setAttestationId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-[#0D3B66] focus:outline-none focus:ring-1 focus:ring-[#0D3B66]"
              >
                <option value="">— Sélectionner —</option>
                {attestations.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.reference} — {a.attributaires?.nom ?? "?"} ({a.statut})
                  </option>
                ))}
              </select>
            </div>
          )}

          {type === "honoraires" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Démarche concernée</label>
              <select
                value={demarcheId}
                onChange={(e) => setDemarcheId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-[#0D3B66] focus:outline-none focus:ring-1 focus:ring-[#0D3B66]"
              >
                <option value="">— Sélectionner —</option>
                {demarches.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.type ?? "Démarche"} — {d.attributaires?.nom ?? "?"} ({fcfa(d.montant_honoraires)})
                  </option>
                ))}
              </select>
            </div>
          )}

          {type === "vente_terrain" && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Vente</label>
                <select
                  value={venteId}
                  onChange={(e) => setVenteId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-[#0D3B66] focus:outline-none focus:ring-1 focus:ring-[#0D3B66]"
                >
                  <option value="">— Sélectionner —</option>
                  {ventes.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.attributaires?.nom ?? "?"} — {fcfa(v.prix_total)} ({v.type_vente})
                    </option>
                  ))}
                </select>
              </div>
              {venteChoisie?.type_vente === "echelonne" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Échéance</label>
                  <select
                    value={echeanceId}
                    onChange={(e) => setEcheanceId(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-[#0D3B66] focus:outline-none focus:ring-1 focus:ring-[#0D3B66]"
                  >
                    <option value="">— Sélectionner —</option>
                    {echeances.map((e) => (
                      <option key={e.id} value={e.id}>
                        Échéance {e.numero} — {fcfa(e.montant_du)} (due le {e.date_echeance})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {type === "autre" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Attributaire concerné</label>
              <select
                value={autreAttributaireId}
                onChange={(e) => setAutreAttributaireId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-[#0D3B66] focus:outline-none focus:ring-1 focus:ring-[#0D3B66]"
              >
                <option value="">— Sélectionner —</option>
                {attributaires.map((a) => (
                  <option key={a.id} value={a.id}>{a.nom}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Montant total (FCFA)</label>
            <input
              type="number"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              readOnly={type === "honoraires" || (type === "vente_terrain" && !!venteChoisie)}
              placeholder="Ex : 250000"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 read-only:bg-slate-50 focus:border-[#0D3B66] focus:outline-none focus:ring-1 focus:ring-[#0D3B66]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Bénéficiaire</label>
            <input
              type="text"
              value={beneficiaire}
              onChange={(e) => setBeneficiaire(e.target.value)}
              placeholder="Nom complet"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-[#0D3B66] focus:outline-none focus:ring-1 focus:ring-[#0D3B66]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Moyen de paiement</label>
            <select
              value={moyen}
              onChange={(e) => setMoyen(e.target.value)}
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
  const supabase = useMemo(() => createClient(), []);

  const [paiements, setPaiements] = useState<PaiementRecord[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentAttributaireId, setCurrentAttributaireId] = useState<string | null>(null);
  const [groupe, setGroupe] = useState<Groupe | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [vue, setVue] = useState<"registre" | "a_valider">("registre");

  const canCreate = groupe === "admin" || groupe === "operateur";
  const isAdmin = groupe === "admin";

  const loadPaiements = useCallback(async () => {
    setDataLoading(true);
    const { data } = await supabase
      .from("paiements")
      .select("id, type, montant_total, commission_sgfn, beneficiaire, moyen, statut, cree_le, acquereur_id, reference_externe, reference, echeance_id, vente_id, attributaires(nom), ventes(type_vente)")
      .order("cree_le", { ascending: false });
    setPaiements((data ?? []) as unknown as PaiementRecord[]);
    setDataLoading(false);
  }, [supabase]);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("groupe, attributaire_id")
        .eq("id", user.id)
        .single();
      if (profile) {
        setGroupe(profile.groupe as Groupe);
        setCurrentAttributaireId(profile.attributaire_id);
      }

      await loadPaiements();
    };
    void init();
  }, [loadPaiements, supabase]);

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
    window.location.assign(res.data.payment_url);
  };

  const handleValider = async (p: PaiementRecord) => {
    if (!currentUserId) return;
    setValidatingId(p.id);
    const { error } = await supabase.rpc("valider_paiement_manuel", {
      p_paiement_id: p.id,
      p_validateur: currentUserId,
    });
    if (!error) await loadPaiements();
    setValidatingId(null);
  };

  const handleTelechargerRecu = async (p: PaiementRecord) => {
    if (!p.reference) return;
    setDownloadingId(p.id);
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
          body: JSON.stringify({ table: "paiements", reference: p.reference }),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.erreur || "Erreur");
      window.open(json.url, "_blank");
    } catch {
      setPayError("Le reçu n'est pas encore disponible pour ce paiement.");
    } finally {
      setDownloadingId(null);
    }
  };

  const confirmes = paiements.filter((p) => p.statut === "confirme");
  const totalEncaisse = confirmes.reduce((s, p) => s + (p.montant_total ?? 0), 0);
  const totalCommission = confirmes.reduce((s, p) => s + (p.commission_sgfn ?? 0), 0);
  const enAttente = paiements.filter((p) => p.statut === "en_attente").length;
  const aValider = paiements.filter((p) => p.statut === "en_attente_validation");

  const paiementsAffiches = vue === "a_valider" ? aValider : paiements;

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

      {isAdmin && (
        <div className="mb-5 flex gap-2">
          <button
            onClick={() => setVue("registre")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${vue === "registre" ? "bg-[#0D3B66] text-white" : "bg-white text-slate-600 border border-slate-200"}`}
          >
            Registre
          </button>
          <button
            onClick={() => setVue("a_valider")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${vue === "a_valider" ? "bg-[#0D3B66] text-white" : "bg-white text-slate-600 border border-slate-200"}`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            À valider {aValider.length > 0 && `(${aValider.length})`}
          </button>
        </div>
      )}

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
      {vue === "registre" && (
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
      )}

      {/* Tableau */}
      <div className="overflow-hidden rounded-xl border border-slate-200/60 bg-white">
        <div className="border-b border-slate-200/60 bg-slate-50/50 px-5 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {vue === "a_valider" ? "Paiements en attente de validation manuelle" : "Registre des transactions"}
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
              ) : paiementsAffiches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <Receipt className="h-6 w-6 text-slate-300" />
                      {vue === "a_valider" ? "Aucun paiement à valider." : "Aucun paiement enregistré."}
                    </div>
                  </td>
                </tr>
              ) : (
                paiementsAffiches.map((p) => {
                  const cfg = STATUT_CONFIG[p.statut ?? "en_attente"] ?? STATUT_CONFIG.en_attente;
                  const canPay =
                    vue === "registre" &&
                    p.statut === "en_attente" &&
                    !isMoyenManuel(p.moyen) &&
                    p.acquereur_id === currentAttributaireId;

                  return (
                    <tr key={p.id} className="transition-colors hover:bg-slate-50/60">
                      <td className="px-5 py-4 font-mono text-xs font-medium text-[#0D3B66]">
                        {p.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="max-w-[180px] truncate px-5 py-4 text-sm text-slate-700">
                        {p.beneficiaire || (p.attributaires as { nom: string | null } | null)?.nom || "—"}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {labelTypePaiement(p.type, p.ventes?.type_vente)}
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
                        {vue === "a_valider" && (
                          <button
                            onClick={() => void handleValider(p)}
                            disabled={validatingId === p.id}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2D8F5A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#256b48] disabled:opacity-60"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {validatingId === p.id ? "…" : "Valider"}
                          </button>
                        )}
                        {vue === "registre" && p.statut === "confirme" && p.reference && (
                          <button
                            onClick={() => void handleTelechargerRecu(p)}
                            disabled={downloadingId === p.id}
                            title="Télécharger le reçu"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                          >
                            <Download className="h-3.5 w-3.5" />
                            {downloadingId === p.id ? "…" : "Reçu"}
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
