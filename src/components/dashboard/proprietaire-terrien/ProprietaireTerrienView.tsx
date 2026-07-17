"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useChargement } from "@/hooks/useChargement";
import { createClient } from "@/utils/supabase/client";
import {
  Building2, ChevronDown, ChevronRight, FileText, CheckCircle2, Clock, PenLine,
  FileWarning, Handshake, Store,
} from "lucide-react";
import type { Profile, AttestationCoutumiere, PvReunion } from "@/components/dashboard/chefferie/types";
import {
  PV_STATUT_LABELS, PV_STATUT_COLORS, SignaturesBadges, ProgressBar, LoadingScreen, StatCard,
} from "@/components/dashboard/chefferie/SharedUI";
import {
  LotDetailModal, QUALITE_LABELS,
  type LotRecord, type LitigeRow, type ScoreConfiance,
} from "@/components/dashboard/lots/LotDetailModal";

// ─── Espace Propriétaire terrien ──────────────────────────────────────────────
// Vue de tout détenteur foncier de PREMIER NIVEAU — celui qui tient son droit de
// la chaîne coutumière (guide de répartition), par opposition au propriétaire par
// achat (rôle `proprietaire`, /dashboard/proprietaire) et à l'acquéreur.
//
// Deux populations, un seul écran :
//   • le chef de famille (`famille_id`) — voit en plus l'APFC, les PV de famille
//     et les lots du collectif d'ayants-droit ;
//   • la personne seule (`attributaire_id` sans famille) — le cas le plus courant :
//     23 personnes physiques détiennent 447 lots en qualité d'ayant droit.
// Un compte peut être les deux (N'CHO OHOUO BONIFACE : chef de la lignée Ako Djebe
// ET détenteur de 110 lots à son nom propre).
//
// Deux points d'entrée : /dashboard/proprietaire-terrien (rôle formel) et
// /dashboard/chefferie pour les comptes legacy `groupe='chefferie'` avec une
// famille — les deux modèles cohabitent indéfiniment.

// ─── Types privés à cette vue ─────────────────────────────────────────────────

type Famille = {
  id: string;
  nom: string;
  chef_de_famille: string | null;
  lignee: { nom: string } | null;
  attributaire_id: string | null;
};

type AttributionRow = {
  rang: number | null;
  qualite: string | null;
  lot: {
    id: string;
    numero_lot: string | null;
    statut: string;
    ilots?: { numero: string | null; lotissements?: { nom: string | null } | null } | null;
  } | null;
};

/** Une ligne de lot, à plat — la provenance (perso/collectif) devient un attribut. */
type LotLigne = {
  lotId: string;
  numeroLot: string | null;
  statut: string;
  ilotNumero: string | null;
  lotissement: string;
  qualite: string | null;
  rang: number | null;
  collectif: boolean;
};

type Annonce = { id: string; lot_id: string; statut: string };

const LOT_STATUT_COLORS: Record<string, string> = {
  attribue: "bg-emerald-50 text-emerald-700 border-emerald-200",
  vendu: "bg-blue-50 text-blue-700 border-blue-200",
  libre: "bg-slate-100 text-slate-500 border-slate-200",
  en_litige: "bg-red-50 text-red-700 border-red-200",
};

const ANNONCE_LABELS: Record<string, string> = {
  active: "En vente",
  brouillon: "Brouillon",
  suspendue: "Suspendue",
  vendue: "Vendue",
};

const SANS_LOTISSEMENT = "Lotissement non renseigné";

// ─── Vue ──────────────────────────────────────────────────────────────────────

export function ProprietaireTerrienView({ profile }: { profile: Profile }) {
  const supabase = createClient();
  const [famille, setFamille] = useState<Famille | null>(null);
  const [mesLots, setMesLots] = useState<AttributionRow[]>([]);
  const [lotsCollectifs, setLotsCollectifs] = useState<AttributionRow[]>([]);
  const [apfc, setApfc] = useState<AttestationCoutumiere[]>([]);
  const [pvs, setPvs] = useState<PvReunion[]>([]);
  const [litigesActifsCount, setLitigesActifsCount] = useState(0);
  const [concertationCount, setConcertationCount] = useState(0);

  // Éligibilité TerraCI Market : un lot est vendable si un document foncier est
  // *délivré* au nom de l'attributaire — même règle que l'edge function
  // `publier-annonce`, qui refuse tout le reste en 403.
  const [lotsAvecDocDelivre, setLotsAvecDocDelivre] = useState<Set<string>>(new Set());
  const [annonces, setAnnonces] = useState<Record<string, Annonce>>({});

  const [signing, setSigning] = useState<string | null>(null);
  const [signError, setSignError] = useState<string | null>(null);

  // Groupes de lotissements dépliés (repliés par défaut : un portefeuille réel
  // dépasse la centaine de lots).
  const [ouverts, setOuverts] = useState<Record<string, boolean>>({});

  // Dossier foncier d'un lot (lecture seule), ouvert au clic sur une ligne.
  const [dossierLot, setDossierLot] = useState<LotRecord | null>(null);
  const [dossierLitiges, setDossierLitiges] = useState<LitigeRow[]>([]);
  const [dossierScore, setDossierScore] = useState<ScoreConfiance | null>(null);
  const [dossierEnCours, setDossierEnCours] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const attributaireId = profile.attributaire_id;

    const [familleRes, mesLotsRes, apfcRes, litigesRes, concertationRes, attRes, certRes, annRes] =
      await Promise.all([
        profile.famille_id
          ? supabase
              .from("familles")
              .select("id, nom, chef_de_famille, lignee:lignee_id(nom), attributaire_id")
              .eq("id", profile.famille_id)
              .single()
          : Promise.resolve({ data: null }),
        attributaireId
          ? supabase
              .from("attributions")
              .select("rang, qualite, lot:lot_id(id, numero_lot, statut, ilots(numero, lotissements(nom)))")
              .eq("attributaire_id", attributaireId)
              .eq("actuel", true)
          : Promise.resolve({ data: [] }),
        profile.famille_id
          ? supabase
              .from("attestations_coutumieres")
              .select("id, reference, numero, statut, date_delivrance, sig_chef_famille_le, sig_chef_village_le, sig_cvgfr_le, chef_de_famille")
              .eq("famille_id", profile.famille_id)
          : Promise.resolve({ data: [] }),
        // Litiges actifs (RLS scopée à ses parcelles) + concertations où il participe.
        supabase.from("litiges").select("id", { count: "exact", head: true }).neq("statut", "clos"),
        supabase.from("conversation_participants").select("profile_id", { count: "exact", head: true }).eq("profile_id", profile.id),
        // Documents délivrés à SON nom. Le filtre explicite sur acquereur_id double
        // la RLS (`acquereur_id = mon_attributaire_id()`) : sans lui, un admin qui
        // ouvre cette page verrait tous les lots du pays comme « vendables ».
        attributaireId
          ? supabase
              .from("attestations_cession")
              .select("lot_id")
              .eq("statut", "delivree")
              .eq("acquereur_id", attributaireId)
          : Promise.resolve({ data: [] }),
        attributaireId
          ? supabase
              .from("certificats_vente")
              .select("lot_id")
              .eq("statut", "delivree")
              .eq("acquereur_id", attributaireId)
          : Promise.resolve({ data: [] }),
        // Annonces déjà déposées (RLS : proprietaire_profile_id = auth.uid()).
        supabase
          .from("annonces_marketplace")
          .select("id, lot_id, statut")
          .eq("proprietaire_profile_id", profile.id),
      ]);

    const familleData = familleRes.data as Famille | null;
    setFamille(familleData);
    setMesLots((mesLotsRes.data ?? []) as unknown as AttributionRow[]);
    setApfc((apfcRes.data ?? []) as AttestationCoutumiere[]);
    setLitigesActifsCount(litigesRes.count ?? 0);
    setConcertationCount(concertationRes.count ?? 0);

    const docs = new Set<string>();
    ((attRes.data ?? []) as { lot_id: string }[]).forEach((r) => docs.add(r.lot_id));
    ((certRes.data ?? []) as { lot_id: string }[]).forEach((r) => docs.add(r.lot_id));
    setLotsAvecDocDelivre(docs);

    const annMap: Record<string, Annonce> = {};
    ((annRes.data ?? []) as Annonce[]).forEach((a) => { annMap[a.lot_id] = a; });
    setAnnonces(annMap);

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
      setLotsCollectifs((lotsColRes.data ?? []) as unknown as AttributionRow[]);

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

  // Perso + collectif fusionnés puis regroupés par lotissement (décision produit :
  // un portefeuille se lit par lotissement, pas par provenance du droit).
  const groupes = useMemo(() => {
    const lignes: LotLigne[] = [];
    const pousser = (rows: AttributionRow[], collectif: boolean) => {
      rows.forEach((a) => {
        if (!a.lot?.id) return;
        lignes.push({
          lotId: a.lot.id,
          numeroLot: a.lot.numero_lot,
          statut: a.lot.statut,
          ilotNumero: a.lot.ilots?.numero ?? null,
          lotissement: a.lot.ilots?.lotissements?.nom ?? SANS_LOTISSEMENT,
          qualite: a.qualite,
          rang: a.rang,
          collectif,
        });
      });
    };
    pousser(lotsCollectifs, true);
    pousser(mesLots, false);

    const parLotissement = new Map<string, LotLigne[]>();
    lignes.forEach((l) => {
      const arr = parLotissement.get(l.lotissement);
      if (arr) arr.push(l);
      else parLotissement.set(l.lotissement, [l]);
    });

    return [...parLotissement.entries()]
      .map(([nom, lots]) => ({
        nom,
        lots: [...lots].sort((a, b) =>
          (a.numeroLot ?? "").localeCompare(b.numeroLot ?? "", "fr", { numeric: true })
        ),
      }))
      .sort((a, b) => b.lots.length - a.lots.length);
  }, [mesLots, lotsCollectifs]);

  if (loading) return <LoadingScreen />;

  const pvAFournir = pvs.filter((p) => p.statut === "a_fournir").length;
  const apfcNonSignees = apfc.filter((a) => !a.sig_chef_famille_le).length;
  const lotsTotal = mesLots.length + lotsCollectifs.length;
  const estChefDeFamille = !!profile.famille_id;

  const annoncesActives = Object.values(annonces).filter((a) => a.statut === "active").length;
  const vendables = groupes
    .flatMap((g) => g.lots)
    .filter((l) => estVendable(l, lotsAvecDocDelivre, annonces)).length;

  // Un seul lotissement : replier n'apporte rien, on l'ouvre d'emblée.
  const estOuvert = (nom: string) => ouverts[nom] ?? groupes.length === 1;

  const cartes = [
    ...(estChefDeFamille
      ? [
          { href: "#apfc", icon: PenLine, label: "APFC à signer", value: apfcNonSignees, subtitle: apfcNonSignees > 0 ? "En attente de votre signature" : "À jour", alerte: apfcNonSignees },
          { href: "#pv", icon: FileText, label: "PV de famille", value: pvs.length, subtitle: pvAFournir > 0 ? `${pvAFournir} à régulariser` : "À jour", alerte: pvAFournir },
        ]
      : []),
    { href: "#lots", icon: Store, label: "TerraCI Market", value: annoncesActives, subtitle: vendables > 0 ? `${vendables} lot${vendables > 1 ? "s" : ""} vendable${vendables > 1 ? "s" : ""}` : "Aucun lot vendable", alerte: 0 },
    { href: "/dashboard/litiges", icon: FileWarning, label: "Litiges", value: litigesActifsCount, subtitle: litigesActifsCount > 0 ? "Sur vos parcelles" : "Aucun litige actif", alerte: litigesActifsCount },
    { href: "/dashboard/concertation", icon: Handshake, label: "Concertation", value: concertationCount, subtitle: "Échanges en cours", alerte: 0 },
  ];

  return (
    <div className="space-y-6">
      {/* En-tête — l'identité affichée est la PERSONNE connectée, jamais la lignée
          (Ako Djebe est la lignée, pas le propriétaire). Un seul cadrage pour tous :
          « Propriétaire terrien ». Il n'y a plus de dashboard « chef de famille »
          distinct — être chef de famille n'ajoute que des rubriques (APFC, PV),
          jamais une identité d'écran séparée. La lignée reste en contexte. */}
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#1E6091]">
          Propriétaire terrien
        </p>
        <h1 className="text-2xl font-bold text-[#0D3B66]">{profile.nom_complet}</h1>
        <p className="text-sm text-slate-500">
          {estChefDeFamille && `Lignée ${famille?.lignee?.nom ?? famille?.nom ?? "—"} · `}
          {lotsTotal} lot{lotsTotal > 1 ? "s" : ""} · {groupes.length} lotissement
          {groupes.length > 1 ? "s" : ""}
        </p>
      </div>

      {signError && (
        <div className="rounded-2xl border border-red-200/70 bg-red-50 px-4 py-3 text-sm text-red-700">{signError}</div>
      )}

      {/* Carte principale — patrimoine */}
      <a
        href="#lots"
        className="group flex items-center justify-between gap-4 rounded-3xl border border-[#0D3B66]/15 bg-gradient-to-br from-[#0D3B66] to-[#1E6091] p-6 text-white shadow-sm transition hover:shadow-md sm:p-8"
      >
        <div>
          <div className="flex items-center gap-2 text-white/70">
            <Building2 className="h-5 w-5" />
            {/* « Mes lots » même pour un chef de famille : ses lots viennent de son
                attributaire personnel, pas du collectif (familles.attributaire_id
                est NULL pour Ako Djebe). Les lots réellement collectifs, s'il y en
                a un jour, restent signalés ligne par ligne. */}
            <span className="text-xs font-semibold uppercase tracking-[0.2em]">Mes lots</span>
          </div>
          <p className="mt-3 text-5xl font-bold leading-none">{lotsTotal}</p>
          <p className="mt-2 max-w-md text-sm text-white/70">
            Cliquez un lot pour ouvrir son dossier, ou mettez-le en vente sur TerraCI Market.
          </p>
        </div>
        <ChevronRight className="h-6 w-6 shrink-0 text-white/60 transition group-hover:translate-x-1" />
      </a>

      {/* Autres rubriques */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cartes.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      {/* Lots regroupés par lotissement — cible de l'ancre #lots */}
      <div id="lots" className="scroll-mt-6 space-y-3">
        {lotsTotal === 0 ? (
          <section className="rounded-2xl border border-slate-200/60 bg-white px-5 py-6 text-sm text-slate-400 shadow-sm">
            Aucun lot rattaché à votre compte pour le moment.
          </section>
        ) : (
          groupes.map((g) => {
            const ouvert = estOuvert(g.nom);
            const enVente = g.lots.filter((l) => annonces[l.lotId]?.statut === "active").length;
            return (
              <section key={g.nom} className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setOuverts((p) => ({ ...p, [g.nom]: !ouvert }))}
                  aria-expanded={ouvert}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-[#0D3B66]">{g.nom}</h2>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {g.lots.length} lot{g.lots.length > 1 ? "s" : ""}
                      {enVente > 0 ? ` · ${enVente} en vente` : ""}
                    </p>
                  </div>
                  {ouvert ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                  )}
                </button>
                {ouvert && (
                  <div className="divide-y divide-slate-100 border-t border-slate-100">
                    {g.lots.map((l) => (
                      <LotRow
                        key={l.lotId}
                        lot={l}
                        annonce={annonces[l.lotId] ?? null}
                        docDelivre={lotsAvecDocDelivre.has(l.lotId)}
                        chargement={dossierEnCours === l.lotId}
                        onOuvrirDossier={() => ouvrirDossier(l.lotId)}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>

      {/* APFC — réservé au chef de famille (document de la lignée) */}
      {estChefDeFamille && (
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
      )}

      {/* PV de réunion de famille — réservé au chef de famille */}
      {estChefDeFamille && (
        <section id="pv" className="scroll-mt-6 overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-[#0D3B66]">PV de réunion de famille</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              Habilitation des ayants-droit à céder ou transmettre les parcelles · Lecture seule
            </p>
          </div>
          {pvs.length === 0 ? (
            <div className="px-5 py-6 text-sm text-slate-400">Aucun PV enregistré.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pvs.map((pv) => (
                <div key={pv.id} className="flex items-center justify-between px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{pv.collectif_nom}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {pv.reference} · {pv.nb_lots} lot{pv.nb_lots !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <span
                    className={`ml-3 shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${
                      PV_STATUT_COLORS[pv.statut] ?? "border-slate-200 bg-slate-100 text-slate-500"
                    }`}
                  >
                    {PV_STATUT_LABELS[pv.statut] ?? pv.statut}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

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

// ─── Éligibilité à la vente ───────────────────────────────────────────────────
// Miroir exact des refus de l'edge function `publier-annonce` : mieux vaut griser
// le bouton en expliquant pourquoi que laisser l'utilisateur remplir un
// formulaire qui finira en 403.

function estVendable(
  lot: LotLigne,
  docs: Set<string>,
  annonces: Record<string, Annonce>
): boolean {
  return (
    !annonces[lot.lotId] &&
    !lot.collectif &&
    lot.statut !== "en_litige" &&
    lot.statut !== "vendu" &&
    docs.has(lot.lotId)
  );
}

/** Pourquoi ce lot n'est pas vendable — null s'il l'est. */
function blocageVente(lot: LotLigne, docDelivre: boolean): string | null {
  // Le collectif n'est pas détenu par la personne connectée mais par le collectif
  // d'ayants-droit : `publier-annonce` compare l'attributaire du document à celui
  // du profil et refuserait. La cession passe par le PV de famille.
  if (lot.collectif) return "Lot du collectif — la cession passe par un PV de famille";
  if (lot.statut === "en_litige") return "Lot en litige — vente impossible tant qu'il n'est pas clos";
  if (lot.statut === "vendu") return "Lot déjà vendu";
  if (!docDelivre) return "Attestation ou certificat pas encore délivré";
  return null;
}

// ─── Ligne de lot ─────────────────────────────────────────────────────────────

function LotRow({
  lot, annonce, docDelivre, chargement, onOuvrirDossier,
}: {
  lot: LotLigne;
  annonce: Annonce | null;
  docDelivre: boolean;
  chargement: boolean;
  onOuvrirDossier: () => void;
}) {
  const blocage = blocageVente(lot, docDelivre);

  return (
    <div className={`flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50 ${chargement ? "opacity-60" : ""}`}>
      <button
        type="button"
        onClick={onOuvrirDossier}
        title="Voir le dossier foncier du lot"
        className="group min-w-0 flex-1 text-left"
      >
        <p className="truncate text-sm font-semibold text-[#0D3B66] underline-offset-2 group-hover:underline">
          Lot {lot.numeroLot ?? "—"}
          {lot.ilotNumero ? ` · Îlot ${lot.ilotNumero}` : ""}
        </p>
        <p className="truncate text-xs text-slate-400">
          {lot.qualite ? QUALITE_LABELS[lot.qualite] ?? lot.qualite : "—"}
          {lot.rang != null ? ` · Rang ${lot.rang}` : ""}
          {lot.collectif ? " · Collectif de la famille" : ""}
        </p>
      </button>

      <span className={`hidden shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium sm:inline ${LOT_STATUT_COLORS[lot.statut] ?? "border-slate-200 bg-slate-100 text-slate-500"}`}>
        {lot.statut}
      </span>

      {annonce ? (
        <Link
          href={`/dashboard/mettre-en-vente?lot=${lot.lotId}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#0D3B66]/20 bg-[#0D3B66]/5 px-3 py-2 text-xs font-semibold text-[#0D3B66] transition hover:bg-[#0D3B66]/10"
        >
          <Store className="h-3.5 w-3.5" />
          {ANNONCE_LABELS[annonce.statut] ?? annonce.statut}
        </Link>
      ) : blocage ? (
        <span
          title={blocage}
          className="inline-flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-400"
        >
          <Store className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Non vendable</span>
        </span>
      ) : (
        <Link
          href={`/dashboard/mettre-en-vente?lot=${lot.lotId}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#0D3B66] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#1E6091]"
        >
          <Store className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Mettre en vente</span>
        </Link>
      )}
    </div>
  );
}
