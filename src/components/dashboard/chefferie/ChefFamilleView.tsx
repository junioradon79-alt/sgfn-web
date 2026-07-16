"use client";

import { useState, useCallback } from "react";
import { useChargement } from "@/hooks/useChargement";
import { createClient } from "@/utils/supabase/client";
import { Building2, ChevronRight, FileText, CheckCircle2, Clock, PenLine, FileWarning, Handshake } from "lucide-react";
import type { Profile, AttestationCoutumiere, PvReunion } from "./types";
import { PV_STATUT_LABELS, PV_STATUT_COLORS, SignaturesBadges, ProgressBar, LoadingScreen, StatCard } from "./SharedUI";
import { LotDetailModal, type LotRecord, type LitigeRow, type ScoreConfiance } from "@/components/dashboard/lots/LotDetailModal";

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
  const [litigesActifsCount, setLitigesActifsCount] = useState(0);
  const [concertationCount, setConcertationCount] = useState(0);

  const [signing, setSigning] = useState<string | null>(null);
  const [signError, setSignError] = useState<string | null>(null);

  // Dossier foncier d'un lot (lecture seule), ouvert au clic sur une ligne.
  const [dossierLot, setDossierLot] = useState<LotRecord | null>(null);
  const [dossierLitiges, setDossierLitiges] = useState<LitigeRow[]>([]);
  const [dossierScore, setDossierScore] = useState<ScoreConfiance | null>(null);
  const [dossierEnCours, setDossierEnCours] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const [familleRes, mesLotsRes, apfcRes, litigesRes, concertationRes] = await Promise.all([
      supabase
        .from("familles")
        .select("id, nom, chef_de_famille, lignee:lignee_id(nom), attributaire_id")
        .eq("id", profile.famille_id!)
        .single(),
      profile.attributaire_id
        ? supabase
            .from("attributions")
            .select("rang, qualite, lot:lot_id(id, numero_lot, statut, ilots(numero, lotissements(nom)))")
            .eq("attributaire_id", profile.attributaire_id)
        : Promise.resolve({ data: [] }),
      supabase
        .from("attestations_coutumieres")
        .select("id, reference, numero, statut, date_delivrance, sig_chef_famille_le, sig_chef_village_le, sig_cvgfr_le, chef_de_famille")
        .eq("famille_id", profile.famille_id!),
      // Litiges actifs (RLS scopée à ses parcelles) + concertations où il participe.
      supabase.from("litiges").select("id", { count: "exact", head: true }).neq("statut", "clos"),
      supabase.from("conversation_participants").select("profile_id", { count: "exact", head: true }).eq("profile_id", profile.id),
    ]);

    const familleData = familleRes.data as Famille | null;
    setFamille(familleData);
    setMesLots((mesLotsRes.data ?? []) as unknown as Attribution[]);
    setApfc((apfcRes.data ?? []) as AttestationCoutumiere[]);
    setLitigesActifsCount(litigesRes.count ?? 0);
    setConcertationCount(concertationRes.count ?? 0);

    // Lots collectifs + PV de famille : scopés au collectif d'ayants-droit de la
    // famille. Le filtre explicite corrige la fuite historique (la RLS scopée sur
    // pv_reunions_famille n'existe que depuis 20260716160000).
    if (familleData?.attributaire_id) {
      const [lotsColRes, pvRes] = await Promise.all([
        supabase
          .from("attributions")
          .select("rang, qualite, lot:lot_id(id, numero_lot, statut, ilots(numero, lotissements(nom)))")
          .eq("attributaire_id", familleData.attributaire_id)
          .eq("actuel", true),
        supabase
          .from("pv_reunions_famille")
          .select("id, reference, objet, statut, date_reunion, collectif:collectif_attributaire_id(nom), pv_reunions_famille_lots(lot_id)")
          .eq("collectif_attributaire_id", familleData.attributaire_id),
      ]);
      setLotsCollectifs((lotsColRes.data ?? []) as unknown as Attribution[]);

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
    } else {
      setLotsCollectifs([]);
      setPvs([]);
    }
  }, [profile.famille_id, profile.attributaire_id, profile.id]);

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

  // Charge le dossier complet d'un lot à la demande, puis affiche le modal partagé.
  const ouvrirDossier = async (lotId: string) => {
    setDossierEnCours(lotId);
    const [{ data: lotData }, { data: litigesData }, { data: scoreData }] = await Promise.all([
      supabase
        .from("lots")
        .select(
          "id, numero_lot, numero_parcelle, ilot_id, statut, verrouille, superficie_m2, est_equipement, nature_droit, observation, guide_page, ilots(id, numero, lotissements(nom, commune, village, autorite_coutumiere_id)), attributions(rang, qualite, actuel, depuis, observation, attributaires(id, nom, type)), attestations_cession(reference, statut, cession_id)"
        )
        .eq("id", lotId)
        .single(),
      supabase.from("litiges").select("id, objet, statut, ouvert_le").eq("lot_id", lotId),
      supabase.rpc("calculer_score_confiance", { p_lot_id: lotId }),
    ]);
    setDossierLitiges((litigesData ?? []) as LitigeRow[]);
    setDossierScore((scoreData ?? null) as ScoreConfiance | null);
    setDossierLot((lotData ?? null) as unknown as LotRecord | null);
    setDossierEnCours(null);
  };

  if (loading) return <LoadingScreen />;

  const pvAFournir = pvs.filter((p) => p.statut === "a_fournir").length;
  const apfcNonSignees = apfc.filter((a) => !a.sig_chef_famille_le).length;
  const lotsTotal = mesLots.length + lotsCollectifs.length;

  const renderLotRow = (a: Attribution, i: number, withRang: boolean) => (
    <button
      key={i}
      type="button"
      onClick={() => a.lot?.id && ouvrirDossier(a.lot.id)}
      title="Voir le dossier foncier du lot"
      className={`group flex w-full items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-slate-50 ${
        dossierEnCours === a.lot?.id ? "opacity-60" : ""
      }`}
    >
      <div>
        <p className="text-sm font-semibold text-[#0D3B66] underline-offset-2 group-hover:underline">
          Lot {a.lot?.numero_lot ?? "—"}
          {a.lot?.ilots?.numero ? ` · Îlot ${a.lot.ilots.numero}` : ""}
        </p>
        <p className="text-xs text-slate-400">
          {a.lot?.ilots?.lotissements?.nom ?? "—"}
          {a.qualite ? ` · ${a.qualite}` : ""}
          {withRang && a.rang != null ? ` · Rang ${a.rang}` : ""}
        </p>
      </div>
      <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${LOT_STATUT_COLORS[a.lot?.statut ?? ""] ?? "border-slate-200 bg-slate-100 text-slate-500"}`}>
        {a.lot?.statut ?? "—"}
      </span>
    </button>
  );

  return (
    <div className="space-y-6">
      {/* En-tête — le dashboard est celui du chef de famille (la personne), pas de
          la lignée : Ako Djebe est la lignée, le chef en poste est l'utilisateur
          connecté (successeur compris, quand il reprend). */}
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#1E6091]">
          Chef de famille
        </p>
        <h1 className="text-2xl font-bold text-[#0D3B66]">
          {profile.nom_complet}
        </h1>
        <p className="text-sm text-slate-500">
          Lignée {famille?.lignee?.nom ?? famille?.nom ?? "—"}
        </p>
      </div>

      {signError && (
        <div className="rounded-2xl border border-red-200/70 bg-red-50 px-4 py-3 text-sm text-red-700">{signError}</div>
      )}

      {/* Carte principale — Lots de la famille */}
      <a
        href="#lots"
        className="group flex items-center justify-between gap-4 rounded-3xl border border-[#0D3B66]/15 bg-gradient-to-br from-[#0D3B66] to-[#1E6091] p-6 text-white shadow-sm transition hover:shadow-md sm:p-8"
      >
        <div>
          <div className="flex items-center gap-2 text-white/70">
            <Building2 className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em]">Lots de la famille</span>
          </div>
          <p className="mt-3 text-5xl font-bold leading-none">{lotsTotal}</p>
          <p className="mt-2 max-w-md text-sm text-white/70">
            Parcelles personnelles et collectives — cliquez un lot pour ouvrir son dossier.
          </p>
        </div>
        <ChevronRight className="h-6 w-6 shrink-0 text-white/60 transition group-hover:translate-x-1" />
      </a>

      {/* Autres rubriques */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          href="#apfc"
          icon={PenLine}
          label="APFC à signer"
          value={apfcNonSignees}
          subtitle={apfcNonSignees > 0 ? "En attente de votre signature" : "À jour"}
          alerte={apfcNonSignees}
        />
        <StatCard
          href="#pv"
          icon={FileText}
          label="PV de famille"
          value={pvs.length}
          subtitle={pvAFournir > 0 ? `${pvAFournir} à régulariser` : "À jour"}
          alerte={pvAFournir}
        />
        <StatCard
          href="/dashboard/litiges"
          icon={FileWarning}
          label="Litiges"
          value={litigesActifsCount}
          subtitle={litigesActifsCount > 0 ? "Sur vos parcelles" : "Aucun litige actif"}
          alerte={litigesActifsCount}
        />
        <StatCard
          href="/dashboard/concertation"
          icon={Handshake}
          label="Concertation"
          value={concertationCount}
          subtitle="Échanges en cours"
        />
      </div>

      {/* Lots (personnels + collectifs) — cible de l'ancre #lots */}
      <div id="lots" className="scroll-mt-6 space-y-6">
        {lotsTotal === 0 ? (
          <section className="rounded-2xl border border-slate-200/60 bg-white px-5 py-6 text-sm text-slate-400 shadow-sm">
            Aucun lot rattaché à votre famille pour le moment.
          </section>
        ) : (
          <>
            {lotsCollectifs.length > 0 && (
              <section className="overflow-hidden rounded-2xl border border-blue-200/60 bg-white shadow-sm">
                <div className="border-b border-blue-100 bg-blue-50/40 px-5 py-4">
                  <h2 className="text-sm font-semibold text-[#0D3B66]">Lots collectifs de la famille</h2>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Parcelles attribuées au collectif d&apos;ayants-droit — {famille?.nom}
                  </p>
                </div>
                <div className="divide-y divide-slate-100">
                  {lotsCollectifs.map((a, i) => renderLotRow(a, i, false))}
                </div>
              </section>
            )}

            {mesLots.length > 0 && (
              <section className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h2 className="text-sm font-semibold text-[#0D3B66]">Mes lots personnels</h2>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Parcelles attribuées à votre nom propre
                  </p>
                </div>
                <div className="divide-y divide-slate-100">
                  {mesLots.map((a, i) => renderLotRow(a, i, true))}
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {/* APFC */}
      <section id="apfc" className="scroll-mt-6 overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
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
      <section id="pv" className="scroll-mt-6 overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
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

      {dossierLot && (
        <LotDetailModal
          lot={dossierLot}
          litiges={dossierLitiges}
          score={dossierScore}
          pvAlert={null}
          onClose={() => setDossierLot(null)}
        />
      )}
    </div>
  );
}
