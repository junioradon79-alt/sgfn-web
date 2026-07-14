"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useChargement } from "@/hooks/useChargement";
import { createClient } from "@/utils/supabase/client";
import Link from "next/link";
import { MessageSquare, CheckCircle2, Crown } from "lucide-react";
import type { Profile, AttestationCoutumiere, PvReunion } from "@/components/dashboard/chefferie/types";
import { PV_STATUT_LABELS, PV_STATUT_COLORS, SignaturesBadges, ProgressBar, LoadingScreen, MessagerieLink } from "@/components/dashboard/chefferie/SharedUI";
import { ChefFamilleView } from "@/components/dashboard/chefferie/ChefFamilleView";
import { AnalyticsKpis } from "@/components/dashboard/chefferie/AnalyticsKpis";
import { LOT_OCCUPE } from "@/hooks/useAdminOverview";
import { serieParJour } from "@/lib/series";

// ─── Types ────────────────────────────────────────────────────────────────────

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

type Litige = {
  id: string;
  statut: string;
  objet: string | null;
  ouvert_le: string | null;
  lot: { numero_lot: string | null } | null;
};

/** Lot du territoire, version légère pour la composition analytique (occupé/libre/en litige). */
type LotTerritoire = { id: string; statut: string | null; ilot_id: string | null };
type AttestationTerritoire = { statut: string | null; cree_le: string | null };
type RecetteTerritoire = { montant: number; cree_le: string | null };

/**
 * Un `.in("lot_id", ids)` avec plusieurs centaines d'UUID dépasse la longueur
 * d'URL acceptée par PostgREST/Supabase (400 Bad Request) — Brignan Kakodji à
 * lui seul compte 846 lots. On découpe en lots de requêtes et on fusionne côté
 * client plutôt que de filtrer sur une seule requête géante.
 */
async function selectParLots<T>(
  run: (chunk: string[]) => PromiseLike<{ data: T[] | null }>,
  ids: string[],
  taille = 100,
): Promise<T[]> {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += taille) chunks.push(ids.slice(i, i + taille));
  const resultats = await Promise.all(chunks.map(run));
  return resultats.flatMap((r) => r.data ?? []);
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
  const [ilotsTerritoire, setIlotsTerritoire] = useState<{ id: string; lotissement_id: string | null }[]>([]);
  const [lotsTerritoire, setLotsTerritoire] = useState<LotTerritoire[]>([]);
  const [attestationsTerritoire, setAttestationsTerritoire] = useState<AttestationTerritoire[]>([]);
  const [recettes, setRecettes] = useState<RecetteTerritoire[]>([]);
  const [signing, setSigning] = useState<string | null>(null);
  const [signingApfc, setSigningApfc] = useState<string | null>(null);
  const [signError, setSignError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const [autoriteRes, lotissementsRes, apfcRes, recettesRes] = await Promise.all([
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
      // Recettes perçues par la chefferie — scopées directement par autorite_coutumiere_id
      // (dénormalisée sur la ligne par ventiler_paiement()), pas besoin des lotIds.
      supabase
        .from("repartitions_paiement")
        .select("montant, cree_le")
        .eq("autorite_coutumiere_id", profile.autorite_coutumiere_id!)
        .order("cree_le", { ascending: true }),
    ]);

    setAutorite(autoriteRes.data as AutoriteCoutumiere | null);
    const lotissementData = (lotissementsRes.data ?? []) as Lotissement[];
    setLotissements(lotissementData);
    setApfc((apfcRes.data ?? []) as AttestationCoutumiere[]);
    setRecettes((recettesRes.data ?? []) as RecetteTerritoire[]);

    if (lotissementData.length > 0) {
      const lotissementIds = lotissementData.map((l) => l.id);

      const { data: ilotsData } = await supabase
        .from("ilots")
        .select("id, lotissement_id")
        .in("lotissement_id", lotissementIds);
      const ilotsList = (ilotsData ?? []) as { id: string; lotissement_id: string | null }[];
      setIlotsTerritoire(ilotsList);
      const ilotIds = ilotsList.map((i) => i.id);

      if (ilotIds.length > 0) {
        const { data: lotsData } = await supabase
          .from("lots")
          .select("id, statut, ilot_id")
          .in("ilot_id", ilotIds);
        const lotsList = (lotsData ?? []) as LotTerritoire[];
        setLotsTerritoire(lotsList);
        const lotIds = lotsList.map((l) => l.id);

        if (lotIds.length > 0) {
          const [attestationsPendantes, pvLotsRows, litigesRows, attestationsToutes] = await Promise.all([
            selectParLots(
              (chunk) =>
                supabase
                  .from("attestations_cession")
                  .select(
                    "id, reference, statut, sig_chefferie_le, sig_proprietaire_le, sig_operateur_le, date_emission, lot:lot_id(numero_lot, ilots(numero, lotissements(id, nom)))"
                  )
                  .in("lot_id", chunk)
                  .is("sig_chefferie_le", null),
              lotIds,
            ),
            selectParLots(
              (chunk) => supabase.from("pv_reunions_famille_lots").select("pv_id").in("lot_id", chunk),
              lotIds,
            ),
            selectParLots(
              (chunk) =>
                supabase
                  .from("litiges")
                  .select("id, statut, objet, ouvert_le, lot:lot_id(numero_lot)")
                  .in("lot_id", chunk),
              lotIds,
            ),
            // Toutes les attestations du territoire (pas seulement celles en attente de
            // signature) — pour le total émis et la tendance 30 j de l'écran analytique.
            selectParLots(
              (chunk) => supabase.from("attestations_cession").select("statut, cree_le").in("lot_id", chunk),
              lotIds,
            ),
          ]);

          setAttestations(attestationsPendantes as unknown as AttestationCession[]);
          setLitiges(litigesRows as unknown as Litige[]);
          setAttestationsTerritoire(attestationsToutes as AttestationTerritoire[]);

          const pvIds = [
            ...new Set(
              pvLotsRows.map(
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

  }, [profile.autorite_coutumiere_id]);

  const { isLoading: loading } = useChargement(fetchData, [fetchData]);

  const signerAttestation = async (id: string) => {
    setSigning(id);
    setSignError(null);
    const { error } = await supabase
      .from("attestations_cession")
      .update({ sig_chefferie_le: new Date().toISOString() })
      .eq("id", id);
    if (error) setSignError(`Signature non enregistrée : ${error.message}`);
    setSigning(null);
    void fetchData();
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
    void fetchData();
  };

  // Composition du territoire (global + par lotissement) — dérivée des lots déjà
  // chargés, sans requête supplémentaire.
  const composition = useMemo(() => {
    const ilotVersLotissement = new Map(ilotsTerritoire.map((i) => [i.id, i.lotissement_id]));
    let occupes = 0;
    let libres = 0;
    let enLitige = 0;
    const parLotissement = new Map<string, { lots: number; occupes: number; libres: number; enLitige: number }>();

    for (const lot of lotsTerritoire) {
      const statut = lot.statut ?? "";
      const estOccupe = LOT_OCCUPE.includes(statut);
      const estLibre = statut === "libre" || statut === "reserve_equipement";
      const estEnLitige = statut === "en_litige";
      if (estOccupe) occupes += 1;
      else if (estLibre) libres += 1;
      else if (estEnLitige) enLitige += 1;

      const lotissementId = lot.ilot_id ? ilotVersLotissement.get(lot.ilot_id) : null;
      if (!lotissementId) continue;
      const acc = parLotissement.get(lotissementId) ?? { lots: 0, occupes: 0, libres: 0, enLitige: 0 };
      acc.lots += 1;
      if (estOccupe) acc.occupes += 1;
      else if (estLibre) acc.libres += 1;
      else if (estEnLitige) acc.enLitige += 1;
      parLotissement.set(lotissementId, acc);
    }

    return { occupes, libres, enLitige, parLotissement };
  }, [lotsTerritoire, ilotsTerritoire]);

  const acteSerie = useMemo(
    () => serieParJour(attestationsTerritoire.map((a) => a.cree_le), 30),
    [attestationsTerritoire],
  );

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

      {signError && (
        <div className="rounded-2xl border border-red-200/70 bg-red-50 px-4 py-3 text-sm text-red-700">{signError}</div>
      )}

      {/* Analytics du territoire */}
      <AnalyticsKpis
        loading={loading}
        territoire={{
          lots: lotsTerritoire.length,
          occupes: composition.occupes,
          libres: composition.libres,
          enLitige: composition.enLitige,
          lotissements: lotissements.length,
        }}
        actes={{
          total: attestationsTerritoire.length,
          delivrees: attestationsTerritoire.filter((a) => a.statut === "delivree").length,
          serie: acteSerie,
        }}
        recettes={{
          total: recettes.reduce((s, r) => s + (r.montant ?? 0), 0),
          serie: recettes.map((r) => r.montant ?? 0),
        }}
        alertes={{
          attestationsAValider: attestations.length,
          litiges: litiges.length,
          apfcEnAttente: apfcAValider,
        }}
      />

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
            {lotissements.map((l) => {
              const c = composition.parLotissement.get(l.id);
              return (
                <div key={l.id} className="px-5 py-3.5">
                  <div className="flex items-center justify-between">
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
                  {c && c.lots > 0 && (
                    <p className="mt-1.5 text-xs text-slate-400">
                      {c.occupes} occupé{c.occupes > 1 ? "s" : ""} · {c.libres} libre{c.libres > 1 ? "s" : ""}
                      {c.enLitige > 0 ? ` · ${c.enLitige} en litige` : ""}
                    </p>
                  )}
                </div>
              );
            })}
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
              Lecture seule — Géré par l&apos;équipe SGNF
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
                    {l.objet && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                        {l.objet}
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
          Profil introuvable. Contactez l&apos;administration.
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
          Votre compte n&apos;est pas encore rattaché à une famille ou une autorité
          coutumière. Contactez l&apos;administration SGNF pour finaliser le
          provisionnement.
        </p>
        <Link
          href="/dashboard/messages"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#0D3B66] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1E6091]"
        >
          <MessageSquare className="h-4 w-4" />
          Contacter l&apos;administration
        </Link>
      </div>
    </div>
  );
}
