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
