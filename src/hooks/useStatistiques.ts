"use client";

import * as React from "react";

import { createClient } from "@/utils/supabase/client";
import { fetchAllPages } from "@/lib/supabase-pagination";

/** Un mois de l'axe temporel — toujours 12 points, même quand la base est jeune. */
export type PointMois = { label: string; value: number };

/** Une ligne de classement territorial (district ou commune). */
export type RangTerritoire = {
  nom: string;
  /** Rattachement lisible : commune pour un district, district pour une commune. */
  detail: string;
  lots: number;
  occupes: number;
  /** Part des lots occupés, en %. C'est le critère de classement. */
  taux: number;
  geolocalises: number;
};

export type Statistiques = {
  loading: boolean;
  error: string | null;
  refresh: () => void;

  /** Créations de lots par mois, 12 derniers mois. */
  cadastre: PointMois[];
  /** Actes de cession émis par mois, 12 derniers mois. */
  actes: PointMois[];
  /** Transactions (ventes) par mois, 12 derniers mois. */
  transactions: PointMois[];
  totaux: { cadastre: number; actes: number; transactions: number };

  districts: RangTerritoire[];
  communes: RangTerritoire[];
};

const MOIS_COURTS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

/** Statuts de lot comptés comme occupés — même définition que `useAdminOverview`. */
const LOT_OCCUPE = ["attribue", "vendu", "occupe"];

/**
 * Douze compartiments mensuels vides, du plus ancien au mois courant.
 *
 * L'axe est construit *avant* de lire la base : un mois sans activité doit
 * apparaître comme un creux, pas disparaître de la courbe.
 */
function douzeMois(): { cles: string[]; points: PointMois[] } {
  const cles: string[] = [];
  const points: PointMois[] = [];
  const maintenant = new Date();

  for (let i = 11; i >= 0; i--) {
    const d = new Date(maintenant.getFullYear(), maintenant.getMonth() - i, 1);
    cles.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    points.push({ label: MOIS_COURTS[d.getMonth()], value: 0 });
  }
  return { cles, points };
}

function repartir(dates: Array<string | null>): PointMois[] {
  const { cles, points } = douzeMois();
  const index = new Map(cles.map((c, i) => [c, i]));

  for (const iso of dates) {
    if (!iso) continue;
    const d = new Date(iso);
    const i = index.get(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    if (i !== undefined) points[i].value += 1;
  }
  return points;
}

type LigneLot = { statut: string | null; latitude: number | null; ilot_id: string | null; cree_le: string | null };
type LigneIlot = { id: string; lotissement_id: string | null };
type LigneLotissement = { id: string; district: string | null; commune: string | null };

/**
 * Agrège les lots par échelon territorial.
 *
 * Le rattachement passe par `lots → ilots → lotissements` : c'est le lotissement
 * qui porte district et commune, pas le lot. On joint en mémoire plutôt qu'en
 * embed PostgREST — l'embed sur deux niveaux fait tomber la requête en timeout
 * sur ce volume (cf. `supabase-pagination`).
 */
function classer(
  lots: LigneLot[],
  ilots: LigneIlot[],
  lotissements: LigneLotissement[],
  echelon: "district" | "commune",
): RangTerritoire[] {
  const parIlot = new Map(ilots.map((i) => [i.id, i.lotissement_id]));
  const parLotissement = new Map(lotissements.map((l) => [l.id, l]));

  const cumul = new Map<string, RangTerritoire & { rattachements: Set<string> }>();

  for (const lot of lots) {
    const lotissementId = lot.ilot_id ? parIlot.get(lot.ilot_id) : null;
    const lotissement = lotissementId ? parLotissement.get(lotissementId) : null;
    if (!lotissement) continue;

    const nom = (echelon === "district" ? lotissement.district : lotissement.commune)?.trim();
    if (!nom) continue;
    const rattachement = (echelon === "district" ? lotissement.commune : lotissement.district)?.trim();

    let ligne = cumul.get(nom);
    if (!ligne) {
      ligne = { nom, detail: "", lots: 0, occupes: 0, taux: 0, geolocalises: 0, rattachements: new Set() };
      cumul.set(nom, ligne);
    }
    ligne.lots += 1;
    if (lot.statut && LOT_OCCUPE.includes(lot.statut)) ligne.occupes += 1;
    if (lot.latitude !== null) ligne.geolocalises += 1;
    if (rattachement) ligne.rattachements.add(rattachement);
  }

  return [...cumul.values()]
    .map(({ rattachements, ...ligne }) => ({
      ...ligne,
      taux: ligne.lots > 0 ? (ligne.occupes / ligne.lots) * 100 : 0,
      detail: [...rattachements].sort().join(", "),
    }))
    .sort((a, b) => b.taux - a.taux || b.lots - a.lots);
}

const VIDE = {
  cadastre: douzeMois().points,
  actes: douzeMois().points,
  transactions: douzeMois().points,
  totaux: { cadastre: 0, actes: 0, transactions: 0 },
  districts: [] as RangTerritoire[],
  communes: [] as RangTerritoire[],
};

/**
 * Alimente l'écran Statistiques — séries mensuelles et classements territoriaux.
 *
 * Aucun chiffre n'est estimé : ce que la base ne sait pas, l'écran l'affiche
 * comme absent plutôt que de le combler.
 */
export function useStatistiques(actif = true): Statistiques {
  const [etat, setEtat] = React.useState(VIDE);
  const [loading, setLoading] = React.useState(actif);
  const [error, setError] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);

  const refresh = React.useCallback(() => setTick((t) => t + 1), []);

  React.useEffect(() => {
    if (!actif) return;
    let annule = false;
    const supabase = createClient();

    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Chaque relation est lue à plat puis fusionnée en mémoire : un embed
        // PostgREST à deux niveaux tomberait en timeout sur ce volume.
        // L'ordre par `id` est ce qui rend la pagination fiable.
        // Le client généré surcharge `from()` par nom de table littéral ; ici le
        // nom est un paramètre. On élargit la signature une fois, plutôt que de
        // recopier cinq fois la même chaîne select/order/range.
        const client = supabase as unknown as {
          from: (table: string) => {
            select: (colonnes: string) => {
              order: (
                colonne: string,
                options: { ascending: boolean },
              ) => { range: (de: number, a: number) => PromiseLike<{ data: unknown[] | null }> };
            };
          };
        };

        const page = <T,>(table: string, colonnes: string) =>
          fetchAllPages<T>(
            (de, a) =>
              client.from(table).select(colonnes).order("id", { ascending: true }).range(de, a) as PromiseLike<{
                data: T[] | null;
              }>,
          );

        const [lots, ilots, lotissements, attestations, ventes] = await Promise.all([
          page<LigneLot>("lots", "id, statut, latitude, ilot_id, cree_le"),
          page<LigneIlot>("ilots", "id, lotissement_id"),
          page<LigneLotissement>("lotissements", "id, district, commune"),
          page<{ cree_le: string | null }>("attestations_cession", "id, cree_le"),
          page<{ cree_le: string | null }>("ventes", "id, cree_le"),
        ]);

        if (annule) return;

        const cadastre = repartir(lots.map((l) => l.cree_le));
        const actes = repartir(attestations.map((a) => a.cree_le));
        const transactions = repartir(ventes.map((v) => v.cree_le));

        setEtat({
          cadastre,
          actes,
          transactions,
          totaux: {
            cadastre: cadastre.reduce((s, p) => s + p.value, 0),
            actes: actes.reduce((s, p) => s + p.value, 0),
            transactions: transactions.reduce((s, p) => s + p.value, 0),
          },
          districts: classer(lots, ilots, lotissements, "district"),
          communes: classer(lots, ilots, lotissements, "commune"),
        });
      } catch (e) {
        if (!annule) setError(e instanceof Error ? e.message : "Erreur inconnue");
      } finally {
        if (!annule) setLoading(false);
      }
    })();

    return () => {
      annule = true;
    };
  }, [actif, tick]);

  return { loading, error, refresh, ...etat };
}
