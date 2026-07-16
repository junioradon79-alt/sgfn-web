"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useChargement } from "@/hooks/useChargement";
import { useProfile } from "@/hooks/useProfile";
import type { AttestationCoutumiere } from "@/components/dashboard/chefferie/types";
import { SignaturesBadges, ProgressBar, LoadingScreen } from "@/components/dashboard/chefferie/SharedUI";

// ─── Types ────────────────────────────────────────────────────────────────────

type AttestationCession = {
  id: string;
  reference: string;
  statut: string;
  sig_chefferie_le: string | null;
  sig_proprietaire_le: string | null;
  sig_operateur_le: string | null;
  date_emission: string | null;
  lot: {
    numero_lot: string | null;
    ilots?: { numero: string | null; lotissements?: { id: string; nom: string | null } | null } | null;
  } | null;
};

// ─── Page ─────────────────────────────────────────────────────────────────────
// Signatures/validations du chef de village : attestations de cession à valider
// + APFC à co-signer. Déplacées ici depuis l'Espace Chefferie (qui n'affiche plus
// que des cartes). Atteinte via les cartes APFC / Cessions de l'Espace Chefferie.

export default function ValidationsPage() {
  const supabase = createClient();
  const { profile, loading: profileLoading, isChefferie } = useProfile();

  const [attestations, setAttestations] = useState<AttestationCession[]>([]);
  const [apfc, setApfc] = useState<AttestationCoutumiere[]>([]);
  const [signing, setSigning] = useState<string | null>(null);
  const [signingApfc, setSigningApfc] = useState<string | null>(null);
  const [signError, setSignError] = useState<string | null>(null);

  const autoriteId = profile?.autorite_coutumiere_id ?? null;

  // Cessions scopées au territoire par la RLS (attcess_chefferie_read) ; APFC
  // filtrées sur la juridiction (apfc_read scopée aussi, filtre explicite en plus).
  const fetchData = useCallback(async () => {
    if (!autoriteId) return;
    const [attestationsRes, apfcRes] = await Promise.all([
      supabase
        .from("attestations_cession")
        .select(
          "id, reference, statut, sig_chefferie_le, sig_proprietaire_le, sig_operateur_le, date_emission, lot:lot_id(numero_lot, ilots(numero, lotissements(id, nom)))"
        )
        .is("sig_chefferie_le", null),
      supabase
        .from("attestations_coutumieres")
        .select(
          "id, reference, numero, statut, date_delivrance, sig_chef_famille_le, sig_chef_village_le, sig_cvgfr_le, chef_de_famille"
        )
        .eq("autorite_coutumiere_id", autoriteId),
    ]);
    setAttestations((attestationsRes.data ?? []) as unknown as AttestationCession[]);
    setApfc((apfcRes.data ?? []) as AttestationCoutumiere[]);
  }, [autoriteId]);

  const { isLoading, recharger } = useChargement(fetchData, [autoriteId], !!autoriteId);

  const signerAttestation = async (id: string) => {
    setSigning(id);
    setSignError(null);
    const { error } = await supabase
      .from("attestations_cession")
      .update({ sig_chefferie_le: new Date().toISOString() })
      .eq("id", id);
    if (error) setSignError(`Signature non enregistrée : ${error.message}`);
    setSigning(null);
    void recharger();
  };

  const signerApfc = async (id: string) => {
    setSigningApfc(id);
    setSignError(null);
    const { error } = await supabase
      .from("attestations_coutumieres")
      .update({ sig_chef_village_le: new Date().toISOString() })
      .eq("id", id);
    if (error) setSignError(`Signature non enregistrée : ${error.message}`);
    setSigningApfc(null);
    void recharger();
  };

  if (profileLoading || (isChefferie && isLoading)) return <LoadingScreen />;

  if (!isChefferie || !profile?.autorite_coutumiere_id) {
    return (
      <div className="flex min-h-[300px] items-center justify-center px-4">
        <p className="text-sm text-slate-400">Espace réservé au chef de village.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/dashboard/chefferie"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0D3B66] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Retour à l&apos;Espace Chefferie
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-[#0D3B66]">Validations</h1>
        <p className="text-sm text-slate-500">
          Attestations de cession à valider et APFC à co-signer, sur votre juridiction.
        </p>
      </div>

      {signError && (
        <div className="rounded-2xl border border-red-200/70 bg-red-50 px-4 py-3 text-sm text-red-700">{signError}</div>
      )}

      {/* Attestations de cession à valider */}
      <section id="cessions" className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm scroll-mt-6">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-[#0D3B66]">
            Attestations de cession — En attente de votre validation
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Validez après vérification de la cession hors-système
          </p>
        </div>
        {attestations.length === 0 ? (
          <div className="flex items-center gap-2 px-5 py-6 text-sm text-emerald-600">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> Aucune attestation en attente de validation.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {attestations.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">{a.reference}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Lot {a.lot?.numero_lot ?? "—"}
                    {a.lot?.ilots?.lotissements?.nom ? ` — ${a.lot.ilots.lotissements.nom}` : ""}
                  </p>
                  <SignaturesBadges
                    sigs={[
                      { label: "Propriétaire", done: !!a.sig_proprietaire_le },
                      { label: "Opérateur", done: !!a.sig_operateur_le },
                    ]}
                  />
                </div>
                <button
                  onClick={() => signerAttestation(a.id)}
                  disabled={signing === a.id}
                  className="shrink-0 rounded-xl bg-[#0D3B66] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#1E6091] disabled:opacity-60"
                >
                  {signing === a.id ? "…" : "Valider"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* APFC à co-signer */}
      <section id="apfc" className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm scroll-mt-6">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-[#0D3B66]">
            APFC — Attestations de Propriété Foncière Coutumière
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Documents entérinés par la Chefferie du village
          </p>
        </div>
        {apfc.length === 0 ? (
          <div className="px-5 py-6 text-sm text-slate-400">Aucune APFC sur votre territoire.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {apfc.map((a) => {
              const sig1 = !!a.sig_chef_famille_le;
              const sig2 = !!a.sig_chef_village_le;
              const sig3 = !!a.sig_cvgfr_le;
              const pct = [sig1, sig2, sig3].filter(Boolean).length;
              return (
                <div key={a.id} className="flex items-start justify-between gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800">{a.numero ?? a.reference ?? "APFC"}</p>
                    <p className="mt-0.5 text-xs text-slate-400">Chef de famille : {a.chef_de_famille ?? "—"}</p>
                    <SignaturesBadges
                      sigs={[
                        { label: "Chef de famille", done: sig1 },
                        { label: "Chefferie village", done: sig2 },
                        { label: "CVGFR", done: sig3 },
                      ]}
                    />
                    <ProgressBar value={pct} max={3} />
                  </div>
                  {sig2 ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Validé
                    </span>
                  ) : (
                    <button
                      onClick={() => signerApfc(a.id)}
                      disabled={signingApfc === a.id}
                      className="shrink-0 rounded-xl bg-[#0D3B66] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#1E6091] disabled:opacity-60"
                    >
                      {signingApfc === a.id ? "…" : "Valider"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
