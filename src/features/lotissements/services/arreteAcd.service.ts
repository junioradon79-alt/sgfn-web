import { createClient } from "@/utils/supabase/client";

import type { Database } from "../../../../database.types";

export type ArreteAcd = Database["public"]["Tables"]["arretes_acd_lotissement"]["Row"];
export type NewArreteAcd = Database["public"]["Tables"]["arretes_acd_lotissement"]["Insert"];
export type UpdateArreteAcd = Database["public"]["Tables"]["arretes_acd_lotissement"]["Update"];

export type StatutPieceAdministrative = Database["public"]["Enums"]["statut_piece_administrative"];

/**
 * Arrêté ACD — pièce foncière principale des lotissements de type `acd`
 * (aucun réel en base au 20/08/2026 — le type existe depuis la Phase A mais
 * aucun lotissement n'a encore été reclassé `acd`). Même forme que
 * `arreteApprobation.service.ts`, table séparée par décision explicite du
 * propriétaire (pas de généralisation).
 */

/** Arrêtés ACD de plusieurs lotissements, indexés par `lotissement_id`. */
export async function getArretesAcdParLotissement(lotissementIds: string[]) {
  if (lotissementIds.length === 0) return { data: new Map<string, ArreteAcd>(), error: null };

  const supabase = createClient();
  const { data, error } = await supabase
    .from("arretes_acd_lotissement")
    .select("*")
    .in("lotissement_id", lotissementIds);

  const parLotissement = new Map<string, ArreteAcd>();
  for (const a of data ?? []) {
    parLotissement.set(a.lotissement_id, a as ArreteAcd);
  }

  return { data: parLotissement, error };
}

export async function createArreteAcd(values: NewArreteAcd) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("arretes_acd_lotissement")
    .insert(values)
    .select()
    .single();

  return { data, error };
}

export async function updateArreteAcd(id: string, values: UpdateArreteAcd) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("arretes_acd_lotissement")
    .update(values)
    .eq("id", id)
    .select()
    .single();

  return { data, error };
}
