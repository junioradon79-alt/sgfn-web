"use client";

import { useState, useCallback } from "react";
import { useChargement } from "@/hooks/useChargement";
import { createClient } from "@/utils/supabase/client";
import { Building2, FileText, ClipboardList, CheckCircle2, Clock, PenLine } from "lucide-react";
import type { Profile, AttestationCoutumiere, PvReunion } from "./types";
import { PV_STATUT_LABELS, PV_STATUT_COLORS, SignaturesBadges, ProgressBar, LoadingScreen, MessagerieLink } from "./SharedUI";

// ─── Types privés à cette vue ─────────────────────────────────────────────────

type Famille = {
  id: string;
  nom: string;
  chef_de_famille: string | null;
  lignee: { nom: string } | null;
  attributaire_id: string | null;
};

type Attribution = {
  rang: number | null;
  qualite: string | null;
  lot: {
    id: string;
    numero_lot: string | null;
    statut: string;
    ilots?: { numero: string | null; lotissements?: { nom: string | null } | null } | null;
  } | null;
};

const LOT_STATUT_COLORS: Record<string, string> = {
  attribue: "bg-emerald-50 text-emerald-700 border-emerald-200",
  vendu: "bg-blue-50 text-blue-700 border-blue-200",
  libre: "bg-slate-100 text-slate-500 border-slate-200",
  en_litige: "bg-red-50 text-red-700 border-red-200",
};

// ─── Vue Chef de Famille ──────────────────────────────────────────────────────
// Partagée entre /dashboard/chefferie (comptes legacy groupe='chefferie'+famille_id,
// ex. Koelea-Accor Revu) et /dashboard/proprietaire-terrien (nouveaux comptes
// groupe='proprietaire_terrien') — les deux modèles cohabitent indéfiniment.

export function ChefFamilleView({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const [famille, setFamille] = useState<Famille | null>(null);
  const [mesLots, setMesLots] = useState<Attribution[]>([]);
  const [lotsCollectifs, setLotsCollectifs] = useState<Attribution[]>([]);
  const [apfc, setApfc] = useState<AttestationCoutumiere[]>([]);
  const [pvs, setPvs] = useState<PvReunion[]>([]);

  const [signing, setSigning] = useState<string | null>(null);
  const [signError, setSignError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {

    const [familleRes, mesLotsRes, apfcRes, pvRes] = await Promise.all([
      supabase
        .from("familles")
        .select("id, nom, chef_de_famille, lignee:lignee_id(nom), attributaire_id")
        .eq("id", profile.famille_id!)
        .single(),
      profile.attributaire_id
        ? supabase
            .from("attributions")
            .select(
              "rang, qualite, lot:lot_id(id, numero_lot, statut, ilots(numero, lotissements(nom)))"
            )
            .eq("attributaire_id", profile.attributaire_id)
        : Promise.resolve({ data: [] }),
      supabase
        .from("attestations_coutumieres")
        .select(
          "id, reference, numero, statut, date_delivrance, sig_chef_famille_le, sig_chef_village_le, sig_cvgfr_le, chef_de_famille"
        )
        .eq("famille_id", profile.famille_id!),
      supabase
        .from("pv_reunions_famille")
        .select(
          "id, reference, objet, statut, date_reunion, collectif:collectif_attributaire_id(nom), pv_reunions_famille_lots(lot_id)"
        ),
    ]);

    const familleData = familleRes.data as Famille | null;
    setFamille(familleData);
    setMesLots((mesLotsRes.data ?? []) as unknown as Attribution[]);

    // Lots collectifs de la famille (via le collectif d'ayants-droit lié)
    if (familleData?.attributaire_id) {
      const { data: lotsCol } = await supabase
        .from("attributions")
        .select("rang, qualite, lot:lot_id(id, numero_lot, statut, ilots(numero, lotissements(nom)))")
        .eq("attributaire_id", familleData.attributaire_id)
        .eq("actuel", true);
      setLotsCollectifs((lotsCol ?? []) as unknown as Attribution[]);
    } else {
      setLotsCollectifs([]);
    }
    setApfc((apfcRes.data ?? []) as AttestationCoutumiere[]);

    const pvData = (pvRes.data ?? []) as unknown as {
      id: string;
      reference: string;
      objet: string;
      statut: string;
      date_reunion: string | null;
      collectif: { nom: string } | null;
      pv_reunions_famille_lots: { lot_id: string }[];
    }[];
    setPvs(
      pvData.map((pv) => ({
        id: pv.id,
        reference: pv.reference,
        objet: pv.objet,
        statut: pv.statut,
        date_reunion: pv.date_reunion,
        collectif_nom: pv.collectif?.nom ?? "—",
        nb_lots: pv.pv_reunions_famille_lots?.length ?? 0,
      }))
    );

  }, [profile.famille_id, profile.attributaire_id]);

  const { isLoading: loading } = useChargement(fetchData, [fetchData]);

  const signerApfc = async (apfcId: string) => {
    setSigning(apfcId);
    setSignError(null);
    const { error } = await supabase
      .from("attestations_coutumieres")
      .update({ sig_chef_famille_le: new Date().toISOString() })
      .eq("id", apfcId);
    if (error) setSignError(`Signature non enregistrée : ${error.message}`);
    setSigning(null);
    void fetchData();
  };

  if (loading) return <LoadingScreen />;

  const pvAFournir = pvs.filter((p) => p.statut === "a_fournir").length;
  const apfcNonSignees = apfc.filter((a) => !a.sig_chef_famille_le).length;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#1E6091]">
          Propriétaire terrien
        </p>
        <h1 className="text-2xl font-bold text-[#0D3B66]">
          {famille?.nom ?? "Ma famille"}
        </h1>
        {famille?.lignee && (
          <p className="text-sm text-slate-500">Lignée : {famille.lignee.nom}</p>
        )}
      </div>

      {signError && (
        <div className="rounded-2xl border border-red-200/70 bg-red-50 px-4 py-3 text-sm text-red-700">{signError}</div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Lots famille",
            value: mesLots.length + lotsCollectifs.length,
            icon: Building2,
            color: "text-[#0D3B66]",
            bg: "bg-[#0D3B66]/5",
          },
          {
            label: "PV à régulariser",
            value: pvAFournir,
            icon: ClipboardList,
            color: pvAFournir > 0 ? "text-amber-600" : "text-emerald-600",
            bg: pvAFournir > 0 ? "bg-amber-50" : "bg-emerald-50",
          },
          {
            label: "APFC à valider",
            value: apfcNonSignees,
            icon: PenLine,
            color: apfcNonSignees > 0 ? "text-amber-600" : "text-emerald-600",
            bg: apfcNonSignees > 0 ? "bg-amber-50" : "bg-emerald-50",
          },
          {
            label: "PV de famille",
            value: pvs.length,
            icon: FileText,
            color: "text-[#1E6091]",
            bg: "bg-[#1E6091]/5",
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm"
          >
            <div className={`mb-2 inline-flex rounded-xl ${kpi.bg} p-2`}>
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
            </div>
            <p className="text-2xl font-bold text-slate-800">{kpi.value}</p>
            <p className="mt-0.5 text-xs text-slate-400">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Lots collectifs de la famille */}
      {lotsCollectifs.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-blue-200/60 bg-white shadow-sm">
          <div className="border-b border-blue-100 bg-blue-50/40 px-5 py-4">
            <h2 className="text-sm font-semibold text-[#0D3B66]">Lots collectifs de la famille</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Parcelles attribuées au collectif d&apos;ayants-droit — {famille?.nom}
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {lotsCollectifs.map((a, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Lot {a.lot?.numero_lot ?? "—"}
                    {a.lot?.ilots?.numero ? ` · Îlot ${a.lot.ilots.numero}` : ""}
                  </p>
                  <p className="text-xs text-slate-400">
                    {a.lot?.ilots?.lotissements?.nom ?? "—"}
                    {a.qualite ? ` · ${a.qualite}` : ""}
                  </p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${LOT_STATUT_COLORS[a.lot?.statut ?? ""] ?? "border-slate-200 bg-slate-100 text-slate-500"}`}>
                  {a.lot?.statut ?? "—"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Mes lots personnels */}
      {mesLots.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-[#0D3B66]">Mes lots personnels</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Parcelles attribuées à votre nom propre
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {mesLots.map((a, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Lot {a.lot?.numero_lot ?? "—"}
                    {a.lot?.ilots?.numero ? ` · Îlot ${a.lot.ilots.numero}` : ""}
                  </p>
                  <p className="text-xs text-slate-400">
                    {a.lot?.ilots?.lotissements?.nom ?? "—"}
                    {a.qualite ? ` · ${a.qualite}` : ""}
                    {a.rang != null ? ` · Rang ${a.rang}` : ""}
                  </p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${LOT_STATUT_COLORS[a.lot?.statut ?? ""] ?? "border-slate-200 bg-slate-100 text-slate-500"}`}>
                  {a.lot?.statut ?? "—"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* APFC */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-[#0D3B66]">
            Attestation de Propriété Foncière Coutumière (APFC)
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Document cosigné par la famille et la Chefferie du village
          </p>
        </div>
        {apfc.length === 0 ? (
          <div className="flex items-center gap-2 px-5 py-6 text-sm text-slate-400">
            <Clock className="h-4 w-4 shrink-0" />
            Aucune APFC initiée pour votre famille.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {apfc.map((a) => {
              const sig1 = !!a.sig_chef_famille_le;
              const sig2 = !!a.sig_chef_village_le;
              const sig3 = !!a.sig_cvgfr_le;
              const pct = [sig1, sig2, sig3].filter(Boolean).length;
              return (
                <div key={a.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800">
                        {a.numero ?? a.reference ?? "APFC sans référence"}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        Chef : {a.chef_de_famille ?? "—"}
                      </p>
                      <SignaturesBadges
                        sigs={[
                          { label: "Chef de famille", done: sig1 },
                          { label: "Chef de village", done: sig2 },
                          { label: "CVGFR", done: sig3 },
                        ]}
                      />
                      <ProgressBar value={pct} max={3} />
                    </div>
                    {!sig1 && (
                      <button
                        onClick={() => signerApfc(a.id)}
                        disabled={signing === a.id}
                        className="shrink-0 rounded-xl bg-[#0D3B66] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#1E6091] disabled:opacity-60"
                      >
                        {signing === a.id ? "…" : "Valider"}
                      </button>
                    )}
                    {sig1 && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Validé
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* PV de réunion de famille */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-[#0D3B66]">
            PV de réunion de famille
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Habilitation des ayants-droit à céder ou transmettre les parcelles ·
            Lecture seule
          </p>
        </div>
        {pvs.length === 0 ? (
          <div className="px-5 py-6 text-sm text-slate-400">
            Aucun PV enregistré.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pvs.map((pv) => (
              <div
                key={pv.id}
                className="flex items-center justify-between px-5 py-3.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {pv.collectif_nom}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {pv.reference} · {pv.nb_lots} lot
                    {pv.nb_lots !== 1 ? "s" : ""}
                  </p>
                </div>
                <span
                  className={`ml-3 shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${
                    PV_STATUT_COLORS[pv.statut] ??
                    "border-slate-200 bg-slate-100 text-slate-500"
                  }`}
                >
                  {PV_STATUT_LABELS[pv.statut] ?? pv.statut}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <MessagerieLink subtitle="Contacter l'équipe SGNF" />
    </div>
  );
}
