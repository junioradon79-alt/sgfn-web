"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useChargement } from "@/hooks/useChargement";
import { stagger } from "@/lib/motion";
import type { BadgeKey } from "@/lib/navigation";
import { AppShell } from "@/components/pilotage/AppShell";
import { Badge, CountBadge } from "@/components/ds/badge";
import { Button } from "@/components/ds/button";
import { Card } from "@/components/ds/card";
import { EmptyState } from "@/components/ds/empty-state";
import { Kpi } from "@/components/ds/kpi";
import { createClient } from "@/utils/supabase/client";
import {
  Building2, ChevronDown, ChevronRight, FileText, CheckCircle2, Clock, PenLine,
  FileWarning, Handshake, Store, Eye,
} from "lucide-react";
import type { Profile, AttestationCoutumiere, PvReunion } from "@/components/dashboard/chefferie/types";
import {
  PV_STATUT_LABELS, PV_STATUT_COLORS, SignaturesBadges, ProgressBar,
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

export function ProprietaireTerrienView({
  profile,
  counts,
}: {
  profile: Profile;
  counts: Partial<Record<BadgeKey, number>>;
}) {
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
  // Demande latente : nombre d'acquéreurs qui suivent chaque lot (captage QR).
  const [suiveurs, setSuiveurs] = useState<Record<string, number>>({});

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

    const [familleRes, mesLotsRes, apfcRes, litigesRes, concertationRes, attRes, certRes, annRes, suiveursRes] =
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
        // Demande latente : nb d'acquéreurs qui suivent chacun de mes lots
        // (RPC scopée à mes_lot_ids(), compte agrégé sans identités).
        supabase.rpc("suiveurs_de_mes_lots"),
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

    const suiveursMap: Record<string, number> = {};
    ((suiveursRes.data ?? []) as { lot_id: string; nb_suiveurs: number }[]).forEach(
      (r) => { suiveursMap[r.lot_id] = r.nb_suiveurs; }
    );
    setSuiveurs(suiveursMap);

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

  const { isLoading: loading, recharger } = useChargement(fetchData, [fetchData]);

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

  // Le retour anticipé garde la coquille : sans elle, l'écran perdrait sa barre
  // latérale et son en-tête le temps du chargement, puis les retrouverait.
  if (loading) {
    return (
      <AppShell loading counts={counts} onRefresh={recharger}>
        <div className="flex min-h-[320px] items-center justify-center">
          <span className="text-[13px] font-medium text-muted-2">Chargement de votre patrimoine…</span>
        </div>
      </AppShell>
    );
  }

  const pvAFournir = pvs.filter((p) => p.statut === "a_fournir").length;
  const apfcNonSignees = apfc.filter((a) => !a.sig_chef_famille_le).length;
  const lotsTotal = mesLots.length + lotsCollectifs.length;
  const estChefDeFamille = !!profile.famille_id;

  const annoncesActives = Object.values(annonces).filter((a) => a.statut === "active").length;
  const vendables = groupes
    .flatMap((g) => g.lots)
    .filter((l) => estVendable(l, lotsAvecDocDelivre, annonces)).length;
  // Demande latente : total d'acquéreurs en attente sur les lots pas encore en vente.
  const enAttenteTotal = Object.entries(suiveurs)
    .filter(([lotId]) => annonces[lotId]?.statut !== "active")
    .reduce((s, [, n]) => s + n, 0);

  // Un seul lotissement : replier n'apporte rien, on l'ouvre d'emblée.
  const estOuvert = (nom: string) => ouverts[nom] ?? groupes.length === 1;

  return (
    <AppShell loading={loading} counts={counts} onRefresh={recharger}>
      {/* En-tête — l'identité affichée est la PERSONNE connectée, jamais la lignée
          (Ako Djebe est la lignée, pas le propriétaire). Un seul cadrage pour tous :
          « Propriétaire terrien ». Il n'y a plus de dashboard « chef de famille »
          distinct — être chef de famille n'ajoute que des rubriques (APFC, PV),
          jamais une identité d'écran séparée. La lignée reste en contexte. */}
      <div className="flex flex-col gap-1">
        <p className="text-[11px] font-bold tracking-[0.22em] text-primary uppercase">
          Propriétaire terrien{estChefDeFamille && " · Patrimoine familial"}
        </p>
        <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">
          Mon patrimoine foncier
        </h1>
        <p className="text-[13.5px] text-muted-foreground">
          {profile.nom_complet}
          {estChefDeFamille && ` · Lignée ${famille?.lignee?.nom ?? famille?.nom ?? "—"}`} · {lotsTotal} lot
          {lotsTotal > 1 ? "s" : ""} · {groupes.length} lotissement{groupes.length > 1 ? "s" : ""}
        </p>
        <p className="mt-1 max-w-2xl text-[13px] text-muted-2">
          Consultez vos titres, suivez vos attestations coutumières et mettez un lot en vente sur TerraCI
          Market.
        </p>
      </div>

      {signError && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger-subtle px-4 py-2.5 text-[13px] text-danger">
          {signError}
        </p>
      )}

      <motion.section
        variants={stagger(0, 0.05)}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        aria-label="Indicateurs de mon patrimoine"
      >
        <Kpi
          icon={Building2}
          label="Lots détenus"
          href="#lots"
          loading={loading}
          value={lotsTotal}
          legende={
            <>
              répartis sur {groupes.length} lotissement{groupes.length > 1 ? "s" : ""}
            </>
          }
        />

        {/* Ces deux chiffres sont ceux des cartes « APFC » et « PV de famille »
            plus bas, qui passent en brique dès que la file se remplit : le même
            compte ne peut pas s'écrire en deux couleurs sur un même écran. */}
        {estChefDeFamille && (
          <Kpi
            icon={PenLine}
            label="APFC à signer"
            href="#apfc"
            loading={loading}
            value={apfcNonSignees}
            tone={apfcNonSignees > 0 ? "alert" : "neutral"}
            legende={
              apfcNonSignees > 0 ? (
                <>en attente de votre signature</>
              ) : (
                <>toutes vos attestations sont signées</>
              )
            }
          />
        )}

        {estChefDeFamille && (
          <Kpi
            icon={FileText}
            label="PV de famille"
            href="#pv"
            loading={loading}
            value={pvs.length}
            tone={pvAFournir > 0 ? "alert" : "neutral"}
            legende={pvAFournir > 0 ? <>{pvAFournir} à régulariser</> : <>aucun PV à régulariser</>}
          />
        )}

        <Kpi
          icon={Store}
          label="TerraCI Market"
          href="#lots"
          loading={loading}
          value={annoncesActives}
          legende={
            enAttenteTotal > 0 ? (
              <>
                {enAttenteTotal} acquéreur{enAttenteTotal > 1 ? "s" : ""} en attente sur vos lots
              </>
            ) : vendables > 0 ? (
              <>
                {vendables} lot{vendables > 1 ? "s" : ""} vendable{vendables > 1 ? "s" : ""}
              </>
            ) : (
              <>aucun lot vendable pour l&apos;instant</>
            )
          }
        />

        <Kpi
          icon={FileWarning}
          label="Litiges actifs"
          href="/dashboard/litiges"
          loading={loading}
          value={litigesActifsCount}
          tone={litigesActifsCount > 0 ? "warning" : "neutral"}
          legende={litigesActifsCount > 0 ? <>sur vos parcelles</> : <>aucun litige en cours</>}
        />

        <Kpi
          icon={Handshake}
          label="Concertation"
          href="/dashboard/concertation"
          loading={loading}
          value={concertationCount}
          legende={<>échanges en cours avec la chefferie</>}
        />
      </motion.section>

      {/* Lots regroupés par lotissement — cible de l'ancre #lots */}
      <div id="lots" className="scroll-mt-6 space-y-3">
        {lotsTotal === 0 ? (
          <Card className="p-5">
            <EmptyState
              icon={Building2}
              title="Aucun lot rattaché"
              description="Aucun lot n'est rattaché à votre compte pour le moment."
            />
          </Card>
        ) : (
          groupes.map((g) => {
            const ouvert = estOuvert(g.nom);
            const enVente = g.lots.filter((l) => annonces[l.lotId]?.statut === "active").length;
            return (
              <Card key={g.nom} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOuverts((p) => ({ ...p, [g.nom]: !ouvert }))}
                  aria-expanded={ouvert}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-inset"
                >
                  <div className="min-w-0">
                    <h2 className="truncate text-[13.5px] font-semibold text-foreground">{g.nom}</h2>
                    <p className="mt-0.5 text-[11.5px] text-muted-2">
                      {g.lots.length} lot{g.lots.length > 1 ? "s" : ""}
                      {enVente > 0 ? ` · ${enVente} en vente` : ""}
                    </p>
                  </div>
                  {ouvert ? (
                    <ChevronDown className="size-4 shrink-0 text-muted-2" />
                  ) : (
                    <ChevronRight className="size-4 shrink-0 text-muted-2" />
                  )}
                </button>
                {ouvert && (
                  <div className="divide-y divide-border border-t border-border">
                    {g.lots.map((l) => (
                      <LotRow
                        key={l.lotId}
                        lot={l}
                        annonce={annonces[l.lotId] ?? null}
                        docDelivre={lotsAvecDocDelivre.has(l.lotId)}
                        nbSuiveurs={suiveurs[l.lotId] ?? 0}
                        chargement={dossierEnCours === l.lotId}
                        onOuvrirDossier={() => ouvrirDossier(l.lotId)}
                      />
                    ))}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* APFC — réservé au chef de famille (document de la lignée). Il a la même
          file de signature que la chefferie : même convention brique, et comme
          partout elle n'apparaît que si quelque chose l'attend réellement. */}
      {estChefDeFamille && (
        <Card
          id="apfc"
          tone={!loading && apfcNonSignees > 0 ? "alert" : "default"}
          className="scroll-mt-6 overflow-hidden"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4 group-data-[tone=alert]/card:border-brick group-data-[tone=alert]/card:bg-brick">
            <div className="min-w-0">
              <h2 className="text-[13.5px] font-semibold text-foreground group-data-[tone=alert]/card:text-brick-foreground">
                Attestation de Propriété Foncière Coutumière (APFC)
              </h2>
              <p className="mt-0.5 text-[11.5px] text-muted-2 group-data-[tone=alert]/card:text-brick-foreground/95">
                Document cosigné par la famille et la Chefferie du village
              </p>
            </div>
            {!loading && apfcNonSignees > 0 && <CountBadge tone="inverse" value={apfcNonSignees} />}
          </div>
          {apfc.length === 0 ? (
            <div className="flex items-center gap-2 px-5 py-6 text-[13px] text-muted-2">
              <Clock className="size-4 shrink-0" />
              Aucune APFC initiée pour votre famille.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {apfc.map((a) => {
                const sig1 = !!a.sig_chef_famille_le;
                const sig2 = !!a.sig_chef_village_le;
                const sig3 = !!a.sig_cvgfr_le;
                const pct = [sig1, sig2, sig3].filter(Boolean).length;
                return (
                  <div key={a.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-semibold text-foreground">
                          {a.numero ?? a.reference ?? "APFC sans référence"}
                        </p>
                        <p className="mt-0.5 text-[11.5px] text-muted-2">
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
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => signerApfc(a.id)}
                          loading={signing === a.id}
                          disabled={signing === a.id}
                          className="shrink-0"
                        >
                          Valider
                        </Button>
                      )}
                      {sig1 && (
                        <Badge tone="success" className="shrink-0">
                          <CheckCircle2 className="size-3.5" /> Validé
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* PV de réunion de famille — réservé au chef de famille */}
      {estChefDeFamille && (
        <Card
          id="pv"
          tone={!loading && pvAFournir > 0 ? "alert" : "default"}
          className="scroll-mt-6 overflow-hidden"
        >
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4 group-data-[tone=alert]/card:border-brick group-data-[tone=alert]/card:bg-brick">
            <div className="min-w-0">
              <h2 className="text-[13.5px] font-semibold text-foreground group-data-[tone=alert]/card:text-brick-foreground">
                PV de réunion de famille
              </h2>
              <p className="mt-0.5 text-[11.5px] text-muted-2 group-data-[tone=alert]/card:text-brick-foreground/95">
                Habilitation des ayants-droit à céder ou transmettre les parcelles · Lecture seule
              </p>
            </div>
            {!loading && pvAFournir > 0 && <CountBadge tone="inverse" value={pvAFournir} />}
          </div>
          {pvs.length === 0 ? (
            <div className="px-5 py-6 text-[13px] text-muted-2">Aucun PV enregistré.</div>
          ) : (
            <div className="divide-y divide-border">
              {pvs.map((pv) => (
                <div key={pv.id} className="flex items-center justify-between px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-semibold text-foreground">{pv.collectif_nom}</p>
                    <p className="mt-0.5 text-[11.5px] text-muted-2">
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
        </Card>
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
    </AppShell>
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
  lot, annonce, docDelivre, nbSuiveurs, chargement, onOuvrirDossier,
}: {
  lot: LotLigne;
  annonce: Annonce | null;
  docDelivre: boolean;
  nbSuiveurs: number;
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

      {/* Signal de demande latente : des acquéreurs suivent ce lot (captage QR)
          et seront prévenus dès sa mise en vente — incite à cliquer le bouton. */}
      {nbSuiveurs > 0 && (
        <span
          title={`${nbSuiveurs} acquéreur${nbSuiveurs > 1 ? "s" : ""} attend${nbSuiveurs > 1 ? "ent" : ""} que ce terrain soit mis en vente`}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700"
        >
          <Eye className="h-3.5 w-3.5" />
          {nbSuiveurs}
          <span className="hidden sm:inline">en attente</span>
        </span>
      )}

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
