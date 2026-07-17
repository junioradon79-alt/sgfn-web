import { supabase } from "@/lib/supabase";

import type { NewLotissement, UpdateLotissement } from "../types";

/**
 * 📥 GET ALL
 */
export async function getLotissements() {
  const { data, error } = await supabase
    .from("lotissements")
    .select("*")
    .order("nom", { ascending: true });

  return { data, error };
}

/**
 * 📥 GET ONE
 */
export async function getLotissement(id: string) {
  const { data, error } = await supabase
    .from("lotissements")
    .select("*")
    .eq("id", id)
    .single();

  return { data, error };
}

/**
 * ➕ CREATE
 */
export async function createLotissement(values: NewLotissement) {
  const { data, error } = await supabase
    .from("lotissements")
    .insert(values)
    .select()
    .single();

  return { data, error };
}

/**
 * ✏️ UPDATE
 */
export async function updateLotissement(
  id: string,
  values: UpdateLotissement
) {
  const { data, error } = await supabase
    .from("lotissements")
    .update(values)
    .eq("id", id)
    .select()
    .single();

  return { data, error };
}

/**
 * 🗑 DELETE
 */
export async function deleteLotissement(id: string) {
  const { data, error } = await supabase
    .from("lotissements")
    .delete()
    .eq("id", id);

  return { data, error };
}

/**
 * 📝 PROPOSER (chefferie) — création ou correction soumise à l'approbation du
 * Super Admin, rien n'est appliqué sur `lotissements` avant `approuver_soumission`.
 */
export async function proposerLotissement(
  type: "creation_lotissement" | "modification_lotissement",
  lotissementId: string | null,
  payload: (NewLotissement | UpdateLotissement) & { lotissement_id?: string },
  titre: string
) {
  const { data, error } = await supabase.rpc("soumettre_saisie", {
    p_type: type,
    // La fonction SQL accepte null (cas création de lotissement) ; le générateur
    // de types Supabase type ce paramètre sans DEFAULT comme non-null → cast.
    p_lotissement_id: lotissementId as string,
    p_titre: titre,
    p_payload: payload,
  });

  return { data, error };
}

export type SoumissionLotissement = {
  id: string;
  type: string;
  titre: string | null;
  statut: string;
  commentaire_admin: string | null;
  cree_le: string;
  payload: { nom?: string } | null;
};

/**
 * 📥 GET MES SOUMISSIONS (chefferie) — visibilité sur ses propres propositions
 * en attente/traitées, la RLS ss_read limite déjà à l'auteur.
 */
export async function getMesSoumissionsLotissement() {
  const { data, error } = await supabase
    .from("soumissions_saisie")
    .select("id, type, titre, statut, commentaire_admin, cree_le, payload")
    .in("type", ["creation_lotissement", "modification_lotissement"])
    .order("cree_le", { ascending: false });

  return { data: data as SoumissionLotissement[] | null, error };
}
