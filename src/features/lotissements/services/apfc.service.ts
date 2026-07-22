import { supabase } from "@/lib/supabase";

import type { Database } from "../../../../database.types";

export type Apfc = Database["public"]["Tables"]["attestations_coutumieres"]["Row"];
export type NewApfc = Database["public"]["Tables"]["attestations_coutumieres"]["Insert"];
export type UpdateApfc = Database["public"]["Tables"]["attestations_coutumieres"]["Update"];

export type StatutApfc = Database["public"]["Enums"]["statut_apfc"];

/**
 * Attestation de Propriété Foncière Coutumière — le titre coutumier qui fonde
 * un lotissement, et 40 des 100 points du score de confiance v3.
 *
 * Jusqu'au 22/07 cette table n'avait **aucun chemin d'écriture** dans
 * l'application : le front savait la lire et la signer, jamais la créer, si
 * bien qu'une APFC ne pouvait naître qu'en SQL manuel — ce qui rendait
 * impossible l'onboarding complet d'un territoire à l'écran (dette #15).
 *
 * Circuit arbitré avec le user : **l'admin enregistre, la chefferie signe**
 * ensuite via `/dashboard/validations`. Aucune migration n'a été nécessaire,
 * la policy `apfc_admin_all` autorisant déjà l'écriture à l'admin.
 */

/** APFC de plusieurs lotissements, indexées par `lotissement_id`. */
export async function getApfcParLotissement(lotissementIds: string[]) {
  if (lotissementIds.length === 0) return { data: new Map<string, Apfc>(), error: null };

  const { data, error } = await supabase
    .from("attestations_coutumieres")
    .select("*")
    .in("lotissement_id", lotissementIds);

  const parLotissement = new Map<string, Apfc>();
  for (const a of data ?? []) {
    if (a.lotissement_id) parLotissement.set(a.lotissement_id, a as Apfc);
  }

  return { data: parLotissement, error };
}

export async function createApfc(values: NewApfc) {
  const { data, error } = await supabase
    .from("attestations_coutumieres")
    .insert(values)
    .select()
    .single();

  return { data, error };
}

export async function updateApfc(id: string, values: UpdateApfc) {
  const { data, error } = await supabase
    .from("attestations_coutumieres")
    .update(values)
    .eq("id", id)
    .select()
    .single();

  return { data, error };
}
