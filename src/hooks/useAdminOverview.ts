"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/utils/supabase/client";
import { actionAgenceRequise, type AgenceDemande } from "@/lib/agence-actions";
import { JOUR_MS, serieParJour } from "@/lib/series";
import { messageLecture } from "@/lib/supabase-pagination";

/**
 * Source unique du Centre de pilotage.
 *
 * Toute la page lit ce hook — aucun composant ne requête la base pour son
 * compte. Deux raisons : les chiffres d'un même écran ne peuvent pas se
 * contredire (ils viennent du même instant), et le coût réseau est payé une
 * fois.
 *
 * Le cloisonnement par locataire reste assuré côté serveur par le RLS
 * (`lots_read_scope`) : ce hook ne filtre rien, il lit ce que la session a le
 * droit de voir.
 */

// ─── Types de lignes ──────────────────────────────────────────────────────────

export type AuditEntry = {
  id: number | null;
  table_concernee: string | null;
  enregistrement_id: string | null;
  action: string | null;
  ancienne_valeur: Record<string, unknown> | null;
  nouvelle_valeur: Record<string, unknown> | null;
  effectue_par: string | null;
  effectue_le: string | null;
};

export type DossierAdu = {
  id: string;
  lot_id: string | null;
  adu_numero: string | null;
  statut: string | null;
  depose_le: string | null;
  notes: string | null;
  adu_date: string | null;
  acd_reference: string | null;
};

export type LitigeRow = {
  id: string;
  objet: string | null;
  statut: string | null;
  ouvert_le: string | null;
  lots: { numero_lot: string | null } | null;
};

export type PaiementRow = {
  id: string;
  type: string | null;
  montant_total: number | null;
  commission_sgfn: number | null;
  beneficiaire: string | null;
  moyen: string | null;
  statut: string | null;
  cree_le: string | null;
  reference_externe: string | null;
};

/** Périmètre cartographié : un lotissement enrichi de l'état réel de ses lots. */
export type Perimetre = {
  id: string;
  nom: string;
  commune: string | null;
  village: string | null;
  latitude: number | null;
  longitude: number | null;
  lots: number;
  libres: number;
  occupes: number;
  enLitige: number;
  /** Part de lots occupés — 0 si le périmètre est vide. */
  tauxOccupation: number;
};

/** Lot doté de coordonnées — épinglé individuellement sur la carte. */
export type LotGeo = {
  id: string;
  numero: string | null;
  statut: string | null;
  latitude: number;
  longitude: number;
};

type LotRow = {
  id: string;
  numero_lot: string | null;
  statut: string | null;
  latitude: number | null;
  longitude: number | null;
  cree_le: string | null;
  ilot_id: string | null;
};
type IlotRow = { id: string; lotissement_id: string | null };
type LotissementRow = {
  id: string;
  nom: string | null;
  commune: string | null;
  village: string | null;
  latitude: number | null;
  longitude: number | null;
};
type AttestationRow = { statut: string | null; cree_le: string | null };

// ─── Forme exposée ────────────────────────────────────────────────────────────

export type AdminOverview = {
  loading: boolean;
  error: string | null;
  /** Instant du dernier chargement réussi — affiché dans l'en-tête. */
  majLe: Date | null;
  refresh: () => void;

  patrimoine: {
    lots: number;
    ilots: number;
    lotissements: number;
    attributaires: number;
    libres: number;
    occupes: number;
    enLitige: number;
    /** Lots créés par jour sur les 30 derniers jours. */
    serie: number[];
  };

  couverture: {
    /** Lots dotés de coordonnées GPS. */
    lotsGeolocalises: number;
    perimetresGeolocalises: number;
    /** Part des lots géolocalisés, en %. */
    taux: number;
    perimetres: Perimetre[];
    lotsGeo: LotGeo[];
  };

  actes: {
    attestations: number;
    delivrees: number;
    /** Attestations émises par jour sur les 30 derniers jours. */
    serie: number[];
  };

  recettes: {
    encaisse: number;
    commissions: number;
    enAttente: number;
    paiements: PaiementRow[];
  };

  files: {
    litiges: LitigeRow[];
    litigesOuverts: number;
    dossiersAdu: DossierAdu[];
    dossiersAduTotal: number;
    dossiersAduEnCours: number;
    saisieAValider: number;
    demandesATraiter: number;
  };

  activite: {
    journal: AuditEntry[];
    /** Événements par jour sur les 14 derniers jours. */
    serie: Array<{ label: string; value: number }>;
    total14j: number;
  };
};

// ─── Utilitaires ──────────────────────────────────────────────────────────────

const ADU_TERMINE = ["adu_delivree", "acd_obtenu", "rejete"];
/** Statuts de lot considérés "occupés" — partagé avec les dashboards scopés par rôle (chefferie…) pour que la composition du patrimoine ne se contredise pas d'un écran à l'autre. */
export const LOT_OCCUPE = ["attribue", "vendu", "occupe"];

// ─── Hook ─────────────────────────────────────────────────────────────────────

const VIDE: Omit<AdminOverview, "loading" | "error" | "majLe" | "refresh"> = {
  patrimoine: { lots: 0, ilots: 0, lotissements: 0, attributaires: 0, libres: 0, occupes: 0, enLitige: 0, serie: [] },
  couverture: { lotsGeolocalises: 0, perimetresGeolocalises: 0, taux: 0, perimetres: [], lotsGeo: [] },
  actes: { attestations: 0, delivrees: 0, serie: [] },
  recettes: { encaisse: 0, commissions: 0, enAttente: 0, paiements: [] },
  files: { litiges: [], litigesOuverts: 0, dossiersAdu: [], dossiersAduTotal: 0, dossiersAduEnCours: 0, saisieAValider: 0, demandesATraiter: 0 },
  activite: { journal: [], serie: [], total14j: 0 },
};

type Instantane = typeof VIDE;

/**
 * Lit la base et dérive l'intégralité de l'écran.
 *
 * Fonction pure de module — hors de React : elle ne connaît ni les hooks, ni le
 * cycle de vie du composant. Elle prend un client, elle rend un instantané.
 * C'est ce qui permet de la tester sans monter un arbre React, et c'est ce qui
 * garde l'effet ci-dessous réduit à sa seule responsabilité : orchestrer.
 */
async function chargerOverview(
  supabase: SupabaseClient,
): Promise<{ instantane: Instantane; erreur: string | null }> {
  const depuis14j = new Date(Date.now() - 14 * JOUR_MS).toISOString();

  const [
    lotsRes,
    ilotsRes,
    lotissementsRes,
    attributairesRes,
    attestationsRes,
    paiementsRes,
    litigesRes,
    aduRes,
    journalRes,
    journalSerieRes,
    saisieRes,
    demandesRes,
  ] = await Promise.all([
    // Un seul passage sur les lots : il alimente le patrimoine, la couverture
    // géographique, la composition par statut ET les stats par périmètre.
    supabase.from("lots").select("id, numero_lot, statut, latitude, longitude, cree_le, ilot_id"),
    supabase.from("ilots").select("id, lotissement_id"),
    supabase.from("lotissements").select("id, nom, commune, village, latitude, longitude"),
    supabase.from("attributaires").select("id", { count: "exact", head: true }),
    supabase.from("attestations_cession").select("statut, cree_le"),
    supabase
      .from("paiements")
      .select("id, type, montant_total, commission_sgfn, beneficiaire, moyen, statut, cree_le, reference_externe")
      .order("cree_le", { ascending: false }),
    supabase
      .from("litiges")
      .select("id, objet, statut, ouvert_le, lots(numero_lot)")
      .order("ouvert_le", { ascending: false }),
    supabase
      .from("dossiers_adu")
      .select("id, lot_id, adu_numero, statut, depose_le, notes, adu_date, acd_reference")
      .order("cree_le", { ascending: false }),
    supabase
      .from("journal_audit")
      .select("id, table_concernee, enregistrement_id, action, ancienne_valeur, nouvelle_valeur, effectue_par, effectue_le")
      .order("effectue_le", { ascending: false })
      .limit(40),
    supabase.from("journal_audit").select("effectue_le").gte("effectue_le", depuis14j),
    supabase.from("soumissions_saisie").select("id", { count: "exact", head: true }).eq("statut", "en_attente"),
    supabase
      .from("demandes_acquisition_agence")
      .select("statut, vente_id, vente_statut, vente_paiement_statut, cession_id, paiement_statut, attestation_reference"),
  ]);

  // Une lecture refusée par le RLS ne doit pas vider tout l'écran : on remonte
  // l'erreur, mais chaque bloc dégrade indépendamment vers 0/liste vide.
  //
  // 🔴 Seules TROIS des douze lectures étaient inspectées. Les neuf autres —
  // dont les attestations, les paiements, les litiges et les dossiers ADU —
  // pouvaient tomber en silence : le Centre de pilotage affichait alors « 0
  // acte », « 0 FCFA », « 0 litige » sans un mot, et rien ne distinguait un
  // pays calme d'un écran aveugle. On les nomme toutes, dans l'ordre où on les
  // demande, et on dit LAQUELLE est tombée.
  const premiereErreur =
    (
      [
        ["les lots", lotsRes.error],
        ["les îlots", ilotsRes.error],
        ["les lotissements", lotissementsRes.error],
        ["le compte des attributaires", attributairesRes.error],
        ["les attestations de cession", attestationsRes.error],
        ["les paiements", paiementsRes.error],
        ["les litiges", litigesRes.error],
        ["les dossiers ADU", aduRes.error],
        ["le journal d'audit", journalRes.error],
        ["la série d'activité", journalSerieRes.error],
        ["la file de saisie", saisieRes.error],
        ["les demandes d'acquisition", demandesRes.error],
      ] as const
    )
      .filter(([, e]) => !!e)
      .map(([quoi, e]) => messageLecture(quoi, e!))
      .join(" · ") || null;

  const lots = (lotsRes.data ?? []) as LotRow[];
  const ilots = (ilotsRes.data ?? []) as IlotRow[];
  const lotissements = (lotissementsRes.data ?? []) as LotissementRow[];
  const attestations = (attestationsRes.data ?? []) as AttestationRow[];
  const paiements = (paiementsRes.data ?? []) as unknown as PaiementRow[];
  const litiges = (litigesRes.data ?? []) as unknown as LitigeRow[];
  const dossiersAdu = (aduRes.data ?? []) as unknown as DossierAdu[];
  const journal = (journalRes.data ?? []) as unknown as AuditEntry[];

  // ── Patrimoine ──
  const libres = lots.filter((l) => l.statut === "libre" || l.statut === "reserve_equipement").length;
  const occupes = lots.filter((l) => LOT_OCCUPE.includes(l.statut ?? "")).length;
  const enLitige = lots.filter((l) => l.statut === "en_litige").length;

  // ── Couverture géographique ──
  const lotsGeo: LotGeo[] = lots
    .filter((l): l is LotRow & { latitude: number; longitude: number } => l.latitude != null && l.longitude != null)
    .map((l) => ({ id: l.id, numero: l.numero_lot, statut: l.statut, latitude: l.latitude, longitude: l.longitude }));
  const ilotVersLotissement = new Map(ilots.map((i) => [i.id, i.lotissement_id]));

  const parLotissement = new Map<string, { lots: number; libres: number; occupes: number; enLitige: number }>();
  for (const lot of lots) {
    const lotissementId = lot.ilot_id ? ilotVersLotissement.get(lot.ilot_id) : null;
    if (!lotissementId) continue;
    const acc = parLotissement.get(lotissementId) ?? { lots: 0, libres: 0, occupes: 0, enLitige: 0 };
    acc.lots += 1;
    if (lot.statut === "libre" || lot.statut === "reserve_equipement") acc.libres += 1;
    else if (LOT_OCCUPE.includes(lot.statut ?? "")) acc.occupes += 1;
    else if (lot.statut === "en_litige") acc.enLitige += 1;
    parLotissement.set(lotissementId, acc);
  }

  const perimetres: Perimetre[] = lotissements.map((l) => {
    const s = parLotissement.get(l.id) ?? { lots: 0, libres: 0, occupes: 0, enLitige: 0 };
    return {
      id: l.id,
      nom: l.nom ?? "Périmètre sans nom",
      commune: l.commune,
      village: l.village,
      latitude: l.latitude,
      longitude: l.longitude,
      ...s,
      tauxOccupation: s.lots > 0 ? Math.round((s.occupes / s.lots) * 100) : 0,
    };
  });
  perimetres.sort((a, b) => b.lots - a.lots);

  // ── Recettes ──
  const confirmes = paiements.filter((p) => p.statut === "confirme");
  const encaisse = confirmes.reduce((s, p) => s + (p.montant_total ?? 0), 0);
  const commissions = confirmes.reduce((s, p) => s + (p.commission_sgfn ?? 0), 0);
  const enAttente = paiements.filter(
    (p) => p.statut === "en_attente" || p.statut === "en_attente_validation",
  ).length;

  // ── Files d'attente ──
  const demandes = (demandesRes.data ?? []) as unknown as AgenceDemande[];

  // ── Activité ──
  const serieBrute = serieParJour(
    ((journalSerieRes.data ?? []) as Array<{ effectue_le: string | null }>).map((r) => r.effectue_le),
    14,
  );
  const auj = new Date();
  const serieActivite = serieBrute.map((value, i) => {
    const d = new Date(auj.getTime() - (13 - i) * JOUR_MS);
    return { label: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }), value };
  });

  const instantane: Instantane = {
    patrimoine: {
      lots: lots.length,
      ilots: ilots.length,
      lotissements: lotissements.length,
      attributaires: attributairesRes.count ?? 0,
      libres,
      occupes,
      enLitige,
      serie: serieParJour(lots.map((l) => l.cree_le), 30),
    },
    couverture: {
      lotsGeolocalises: lotsGeo.length,
      perimetresGeolocalises: perimetres.filter((p) => p.latitude != null && p.longitude != null).length,
      taux: lots.length > 0 ? (lotsGeo.length / lots.length) * 100 : 0,
      perimetres,
      lotsGeo,
    },
    actes: {
      attestations: attestations.length,
      delivrees: attestations.filter((a) => a.statut === "delivree").length,
      serie: serieParJour(attestations.map((a) => a.cree_le), 30),
    },
    recettes: { encaisse, commissions, enAttente, paiements },
    files: {
      litiges,
      litigesOuverts: litiges.filter((l) => l.statut !== "clos" && l.statut !== "resolu").length,
      dossiersAdu,
      dossiersAduTotal: dossiersAdu.length,
      dossiersAduEnCours: dossiersAdu.filter((d) => !ADU_TERMINE.includes(d.statut ?? "")).length,
      saisieAValider: saisieRes.count ?? 0,
      demandesATraiter: demandes.filter(actionAgenceRequise).length,
    },
    activite: {
      journal,
      serie: serieActivite,
      total14j: serieBrute.reduce((s, n) => s + n, 0),
    },
  };

  return { instantane, erreur: premiereErreur };
}

export function useAdminOverview(enabled: boolean): AdminOverview {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState(VIDE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [majLe, setMajLe] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);

  /** Relance un chargement. Le compteur est le seul déclencheur de l'effet. */
  const refresh = useCallback(() => {
    setLoading(true);
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let annule = false;

    void (async () => {
      const { instantane, erreur } = await chargerOverview(supabase);
      // Une réponse arrivée après un démontage — ou dépassée par un
      // rafraîchissement plus récent — ne doit pas écraser l'écran.
      if (annule) return;

      setData(instantane);
      setError(erreur);
      setMajLe(new Date());
      setLoading(false);
    })();

    return () => {
      annule = true;
    };
  }, [enabled, supabase, tick]);

  return { ...data, loading, error, majLe, refresh };
}
