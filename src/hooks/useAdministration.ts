"use client";

import * as React from "react";

import { createClient } from "@/utils/supabase/client";

export type CompteSysteme = {
  id: string;
  nom_complet: string | null;
  groupe: string | null;
  telephone: string | null;
  actif: boolean | null;
  cree_le: string | null;
};

export type EntreeAudit = {
  id: number | null;
  table_concernee: string | null;
  action: string | null;
  effectue_par: string | null;
  effectue_le: string | null;
};

export type Tarif = {
  id: string;
  type_demarche: string | null;
  montant_min: number | null;
  montant_max: number | null;
  commission_min: number | null;
  commission_max: number | null;
  actif: boolean | null;
};

export type ParametrePaiement = { cle: string; valeur: string | null; description: string | null };

export type Administration = {
  loading: boolean;
  error: string | null;
  refresh: () => void;
  comptes: CompteSysteme[];
  audit: EntreeAudit[];
  tarifs: Tarif[];
  parametres: ParametrePaiement[];
};

const VIDE = {
  comptes: [] as CompteSysteme[],
  audit: [] as EntreeAudit[],
  tarifs: [] as Tarif[],
  parametres: [] as ParametrePaiement[],
};

/** Le journal complet se compte en dizaines de milliers de lignes : on n'en
 *  affiche que la tête, le reste n'est pas consultable à l'œil de toute façon. */
const AUDIT_MAX = 200;

/**
 * Alimente l'écran Administration (comptes, journal d'audit, paramètres).
 *
 * Lecture seule et strictement admin : la RLS reste la garde réelle, cet écran
 * ne fait que présenter ce qu'elle laisse passer.
 */
export function useAdministration(actif = true): Administration {
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
        const [comptes, audit, tarifs, parametres] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, nom_complet, groupe, telephone, actif, cree_le")
            .order("cree_le", { ascending: false }),
          supabase
            .from("journal_audit")
            .select("id, table_concernee, action, effectue_par, effectue_le")
            .order("effectue_le", { ascending: false })
            .limit(AUDIT_MAX),
          supabase
            .from("tarifs")
            .select("id, type_demarche, montant_min, montant_max, commission_min, commission_max, actif")
            .order("type_demarche", { ascending: true }),
          supabase.from("parametres_paiement").select("cle, valeur, description").order("cle", { ascending: true }),
        ]);

        if (annule) return;

        const souci = comptes.error ?? audit.error ?? tarifs.error ?? parametres.error;
        if (souci) setError(souci.message);

        setEtat({
          comptes: comptes.data ?? [],
          audit: audit.data ?? [],
          tarifs: tarifs.data ?? [],
          parametres: parametres.data ?? [],
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
