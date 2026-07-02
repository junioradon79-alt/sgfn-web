"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import {
  Building2,
  FileText,
  MessageSquare,
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  ChevronRight,
  PenLine,
  Map,
  Crown,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Profile = {
  id: string;
  nom_complet: string;
  groupe: string;
  famille_id: string | null;
  autorite_coutumiere_id: string | null;
  attributaire_id: string | null;
};

type Famille = {
  id: string;
  nom: string;
  chef_de_famille: string | null;
  lignee: string | null;
  attributaire_id: string | null;
};

type AutoriteCoutumiere = {
  id: string;
  nom: string;
  type: string | null;
  village: string | null;
  chef: string | null;
};

type Lotissement = {
  id: string;
  nom: string;
  village: string | null;
  commune: string | null;
  nb_lots: number | null;
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

type AttestationCoutumiere = {
  id: string;
  reference: string | null;
  numero: string | null;
  statut: string;
  date_delivrance: string | null;
  sig_chef_famille_le: string | null;
  sig_chef_village_le: string | null;
  sig_cvgfr_le: string | null;
  chef_de_famille: string | null;
};

type PvReunion = {
  id: string;
  reference: string;
  objet: string;
  statut: string;
  date_reunion: string | null;
  collectif_nom: string;
  nb_lots: number;
};

type Litige = {
  id: string;
  statut: string;
  description: string | null;
  date_ouverture: string | null;
  lot: { numero_lot: string | null } | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PV_STATUT_LABELS: Record<string, string> = {
  a_fournir: "À régulariser",
  en_cours: "En cours",
  valide: "Validé",
  rejete: "Rejeté",
};

const PV_STATUT_COLORS: Record<string, string> = {
  a_fournir: "bg-amber-50 text-amber-700 border-amber-200",
  en_cours: "bg-blue-50 text-blue-700 border-blue-200",
  valide: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejete: "bg-red-50 text-red-700 border-red-200",
};

const LOT_STATUT_COLORS: Record<string, string> = {
  attribue: "bg-emerald-50 text-emerald-700 border-emerald-200",
  vendu: "bg-blue-50 text-blue-700 border-blue-200",
  libre: "bg-slate-100 text-slate-500 border-slate-200",
  en_litige: "bg-red-50 text-red-700 border-red-200",
};

function SignaturesBadges({
  sigs,
}: {
  sigs: { label: string; done: boolean }[];
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {sigs.map((s) => (
        <span
          key={s.label}
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
            s.done
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          }`}
        >
          {s.done ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <Clock className="h-3 w-3" />
          )}
          {s.label}
        </span>
      ))}
    </div>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="h-1.5 w-24 rounded-full bg-slate-100">
        <div
          className="h-1.5 rounded-full bg-[#2D8F5A] transition-all"
          style={{ width: `${(value / max) * 100}%` }}
        />
      </div>
      <span className="text-xs text-slate-400">
        {value}/{max} signatures
      </span>
    </div>
  );
}

// ─── Écran de chargement ──────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="flex min-h-[300px] items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="text-sm font-medium">Chargement de votre espace…</span>
      </div>
    </div>
  );
}

// ─── Lien messagerie ──────────────────────────────────────────────────────────

function MessagerieLink({ subtitle }: { subtitle: string }) {
  return (
    <Link
      href="/dashboard/messages"
      className="flex items-center justify-between rounded-2xl border border-slate-200/60 bg-white px-5 py-4 shadow-sm transition hover:border-[#0D3B66]/30 hover:bg-slate-50"
    >
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-[#0D3B66]/5 p-2">
          <MessageSquare className="h-4 w-4 text-[#0D3B66]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">Messagerie</p>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-slate-400" />
    </Link>
  );
}

// ─── Vue Chef de Famille ──────────────────────────────────────────────────────

function ChefFamilleView({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const [famille, setFamille] = useState<Famille | null>(null);
  const [mesLots, setMesLots] = useState<Attribution[]>([]);
  const [lotsCollectifs, setLotsCollectifs] = useState<Attribution[]>([]);
  const [apfc, setApfc] = useState<AttestationCoutumiere[]>([]);
  const [pvs, setPvs] = useState<PvReunion[]>([]);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [familleRes, mesLotsRes, apfcRes, pvRes] = await Promise.all([
      supabase
        .from("familles")
        .select("id, nom, chef_de_famille, lignee, attributaire_id")
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
    setLoading(false);
  }, [profile.famille_id, profile.attributaire_id]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const signerApfc = async (apfcId: string) => {
    setSigning(apfcId);
    await supabase
      .from("attestations_coutumieres")
      .update({ sig_chef_famille_le: new Date().toISOString() })
      .eq("id", apfcId);
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
          Chef de famille · Chefferie
        </p>
        <h1 className="text-2xl font-bold text-[#0D3B66]">
          {famille?.nom ?? "Ma famille"}
        </h1>
        {famille?.lignee && (
          <p className="text-sm text-slate-500">Lignée : {famille.lignee}</p>
        )}
      </div>

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
              Parcelles attribuées au collectif d'ayants-droit — {famille?.nom}
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

// ─── Vue Chef de Village ──────────────────────────────────────────────────────

function ChefVillageView({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const [autorite, setAutorite] = useState<AutoriteCoutumiere | null>(null);
  const [lotissements, setLotissements] = useState<Lotissement[]>([]);
  const [attestations, setAttestations] = useState<AttestationCession[]>([]);
  const [apfc, setApfc] = useState<AttestationCoutumiere[]>([]);
  const [pvs, setPvs] = useState<PvReunion[]>([]);
  const [litiges, setLitiges] = useState<Litige[]>([]);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState<string | null>(null);
  const [signingApfc, setSigningApfc] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const [autoriteRes, lotissementsRes, apfcRes] = await Promise.all([
      supabase
        .from("autorites_coutumieres")
        .select("id, nom, type, village, chef")
        .eq("id", profile.autorite_coutumiere_id!)
        .single(),
      supabase
        .from("lotissements")
        .select("id, nom, village, commune, nb_lots")
        .eq("autorite_coutumiere_id", profile.autorite_coutumiere_id!),
      supabase
        .from("attestations_coutumieres")
        .select(
          "id, reference, numero, statut, date_delivrance, sig_chef_famille_le, sig_chef_village_le, sig_cvgfr_le, chef_de_famille"
        )
        .eq("autorite_coutumiere_id", profile.autorite_coutumiere_id!),
    ]);

    setAutorite(autoriteRes.data as AutoriteCoutumiere | null);
    const lotissementData = (lotissementsRes.data ?? []) as Lotissement[];
    setLotissements(lotissementData);
    setApfc((apfcRes.data ?? []) as AttestationCoutumiere[]);

    if (lotissementData.length > 0) {
      const lotissementIds = lotissementData.map((l) => l.id);

      const { data: ilotsData } = await supabase
        .from("ilots")
        .select("id")
        .in("lotissement_id", lotissementIds);
      const ilotIds = (ilotsData ?? []).map((i: { id: string }) => i.id);

      if (ilotIds.length > 0) {
        const { data: lotsData } = await supabase
          .from("lots")
          .select("id")
          .in("ilot_id", ilotIds);
        const lotIds = (lotsData ?? []).map((l: { id: string }) => l.id);

        if (lotIds.length > 0) {
          const [attRes, pvLotsRes, litigesRes] = await Promise.all([
            supabase
              .from("attestations_cession")
              .select(
                "id, reference, statut, sig_chefferie_le, sig_proprietaire_le, sig_operateur_le, date_emission, lot:lot_id(numero_lot, ilots(numero, lotissements(id, nom)))"
              )
              .in("lot_id", lotIds)
              .is("sig_chefferie_le", null),
            supabase
              .from("pv_reunions_famille_lots")
              .select("pv_id")
              .in("lot_id", lotIds),
            supabase
              .from("litiges")
              .select("id, statut, description, date_ouverture, lot:lot_id(numero_lot)")
              .in("lot_id", lotIds),
          ]);

          setAttestations(
            (attRes.data ?? []) as unknown as AttestationCession[]
          );
          setLitiges((litigesRes.data ?? []) as unknown as Litige[]);

          const pvIds = [
            ...new Set(
              (pvLotsRes.data ?? []).map(
                (r: { pv_id: string }) => r.pv_id
              )
            ),
          ];
          if (pvIds.length > 0) {
            const pvRes = await supabase
              .from("pv_reunions_famille")
              .select(
                "id, reference, objet, statut, date_reunion, collectif:collectif_attributaire_id(nom), pv_reunions_famille_lots(lot_id)"
              )
              .in("id", pvIds);
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
          }
        }
      }
    }

    setLoading(false);
  }, [profile.autorite_coutumiere_id]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const signerAttestation = async (id: string) => {
    setSigning(id);
    await supabase
      .from("attestations_cession")
      .update({ sig_chefferie_le: new Date().toISOString() })
      .eq("id", id);
    setSigning(null);
    void fetchData();
  };

  const signerApfc = async (id: string) => {
    setSigningApfc(id);
    await supabase
      .from("attestations_coutumieres")
      .update({ sig_chef_village_le: new Date().toISOString() })
      .eq("id", id);
    setSigningApfc(null);
    void fetchData();
  };

  if (loading) return <LoadingScreen />;

  const apfcAValider = apfc.filter((a) => !a.sig_chef_village_le).length;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#1E6091]">
          Chef de village · Chefferie
        </p>
        <h1 className="text-2xl font-bold text-[#0D3B66]">
          {autorite?.nom ?? "Mon autorité coutumière"}
        </h1>
        {autorite?.village && (
          <p className="text-sm text-slate-500">Village : {autorite.village}</p>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Lotissements",
            value: lotissements.length,
            icon: Map,
            color: "text-[#0D3B66]",
            bg: "bg-[#0D3B66]/5",
          },
          {
            label: "Attestations à valider",
            value: attestations.length,
            icon: PenLine,
            color:
              attestations.length > 0 ? "text-amber-600" : "text-emerald-600",
            bg: attestations.length > 0 ? "bg-amber-50" : "bg-emerald-50",
          },
          {
            label: "APFC à valider",
            value: apfcAValider,
            icon: FileText,
            color:
              apfcAValider > 0 ? "text-amber-600" : "text-emerald-600",
            bg: apfcAValider > 0 ? "bg-amber-50" : "bg-emerald-50",
          },
          {
            label: "Litiges actifs",
            value: litiges.length,
            icon: AlertTriangle,
            color: litiges.length > 0 ? "text-red-600" : "text-slate-400",
            bg: litiges.length > 0 ? "bg-red-50" : "bg-slate-50",
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

      {/* Lotissements du territoire */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-[#0D3B66]">
            Lotissements sur votre territoire
          </h2>
        </div>
        {lotissements.length === 0 ? (
          <div className="px-5 py-6 text-sm text-slate-400">
            Aucun lotissement lié à votre autorité.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {lotissements.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between px-5 py-3.5"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {l.nom}
                  </p>
                  <p className="text-xs text-slate-400">
                    {[l.village, l.commune].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className="text-xs text-slate-400">
                  {l.nb_lots ?? "—"} lots
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Attestations de cession à valider */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
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
            <CheckCircle2 className="h-4 w-4 shrink-0" /> Aucune attestation en
            attente de validation.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {attestations.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">
                    {a.reference}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Lot {a.lot?.numero_lot ?? "—"}
                    {(a.lot as { ilots?: { lotissements?: { nom?: string | null } | null } | null })?.ilots?.lotissements?.nom
                      ? ` — ${(a.lot as { ilots?: { lotissements?: { nom?: string | null } | null } | null })?.ilots?.lotissements?.nom}`
                      : ""}
                  </p>
                  <SignaturesBadges
                    sigs={[
                      {
                        label: "Propriétaire",
                        done: !!a.sig_proprietaire_le,
                      },
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
      <section className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-[#0D3B66]">
            APFC — Attestations de Propriété Foncière Coutumière
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Documents entérinés par la Chefferie du village
          </p>
        </div>
        {apfc.length === 0 ? (
          <div className="px-5 py-6 text-sm text-slate-400">
            Aucune APFC sur votre territoire.
          </div>
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
                    <p className="text-sm font-semibold text-slate-800">
                      {a.numero ?? a.reference ?? "APFC"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Chef de famille : {a.chef_de_famille ?? "—"}
                    </p>
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

      {/* PV du territoire */}
      {pvs.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-[#0D3B66]">
              PV de réunion de famille — Territoire
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Lecture seule · {pvs.length} PV sur{" "}
              {lotissements.map((l) => l.nom).join(", ")}
            </p>
          </div>
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
        </section>
      )}

      {/* Litiges actifs */}
      {litiges.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-red-200/60 bg-white shadow-sm">
          <div className="border-b border-red-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-red-700">
              Litiges actifs
            </h2>
            <p className="mt-0.5 text-xs text-red-400">
              Lecture seule — Géré par l'équipe SGNF
            </p>
          </div>
          <div className="divide-y divide-red-50">
            {litiges.map((l) => (
              <div key={l.id} className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">
                      Lot {l.lot?.numero_lot ?? "—"}
                    </p>
                    {l.description && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                        {l.description}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                    {l.statut}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <MessagerieLink subtitle="Contacter l'équipe SGNF ou l'opérateur" />
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function ChefferiePage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select(
          "id, nom_complet, groupe, famille_id, autorite_coutumiere_id, attributaire_id"
        )
        .eq("id", user.id)
        .single();
      setProfile(data as Profile | null);
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoadingScreen />;

  if (!profile) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <p className="text-sm text-slate-400">
          Profil introuvable. Contactez l'administration.
        </p>
      </div>
    );
  }

  if (profile.famille_id) return <ChefFamilleView profile={profile} />;
  if (profile.autorite_coutumiere_id)
    return <ChefVillageView profile={profile} />;

  return (
    <div className="flex min-h-[300px] items-center justify-center px-4">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50">
          <Crown className="h-6 w-6 text-amber-600" />
        </div>
        <p className="text-sm font-semibold text-slate-800">
          Compte en cours de provisionnement
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Votre compte n'est pas encore rattaché à une famille ou une autorité
          coutumière. Contactez l'administration SGNF pour finaliser le
          provisionnement.
        </p>
        <Link
          href="/dashboard/messages"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#0D3B66] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1E6091]"
        >
          <MessageSquare className="h-4 w-4" />
          Contacter l'administration
        </Link>
      </div>
    </div>
  );
}
