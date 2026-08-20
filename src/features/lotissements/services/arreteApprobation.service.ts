import { createClient } from "@/utils/supabase/client";

import type { Database } from "../../../../database.types";

export type ArreteApprobation = Database["public"]["Tables"]["arretes_approbation_lotissement"]["Row"];
export type NewArreteApprobation = Database["public"]["Tables"]["arretes_approbation_lotissement"]["Insert"];
export type UpdateArreteApprobation = Database["public"]["Tables"]["arretes_approbation_lotissement"]["Update"];

export type StatutPieceAdministrative = Database["public"]["Enums"]["statut_piece_administrative"];

/**
 * Arrêté d'approbation — pièce foncière principale des lotissements de type
 * `approuve` (ex. Brignan Kakodji), au même titre que l'APFC
 * (`attestations_coutumieres`) pour les lotissements `villageois`. Table
 * séparée créée en Phase B (migration `20260820100000`) : décision du
 * propriétaire de ne PAS généraliser le modèle documentaire par une table
 * unique.
 *
 * Même circuit que l'APFC (`apfc.service.ts`) : l'admin enregistre/modifie,
 * la policy `arretes_approbation_admin_all` autorise déjà l'écriture.
 *
 * ⚠️ Même piège que documenté sur `apfc.service.ts` : le client vient de
 * `@/utils/supabase/client` (cookie, session `/login`), pas du singleton
 * `@/lib/supabase` (localStorage, lirait la base en anonyme sans erreur
 * visible).
 */

/** Arrêtés d'approbation de plusieurs lotissements, indexés par `lotissement_id`. */
export async function getArretesApprobationParLotissement(lotissementIds: string[]) {
  if (lotissementIds.length === 0) return { data: new Map<string, ArreteApprobation>(), error: null };

  const supabase = createClient();
  const { data, error } = await supabase
    .from("arretes_approbation_lotissement")
    .select("*")
    .in("lotissement_id", lotissementIds);

  const parLotissement = new Map<string, ArreteApprobation>();
  for (const a of data ?? []) {
    parLotissement.set(a.lotissement_id, a as ArreteApprobation);
  }

  return { data: parLotissement, error };
}

export async function createArreteApprobation(values: NewArreteApprobation) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("arretes_approbation_lotissement")
    .insert(values)
    .select()
    .single();

  return { data, error };
}

export async function updateArreteApprobation(id: string, values: UpdateArreteApprobation) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("arretes_approbation_lotissement")
    .update(values)
    .eq("id", id)
    .select()
    .single();

  return { data, error };
}
