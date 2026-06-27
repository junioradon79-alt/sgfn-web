import { supabase } from "@/lib/supabase";

export async function getDashboardStats() {
  const [
    lotissements,
    lots,
    attributaires,
    paiements,
  ] = await Promise.all([
    supabase
      .from("lotissements")
      .select("*", { count: "exact", head: true }),

    supabase
      .from("lots")
      .select("*", { count: "exact", head: true }),

    supabase
      .from("attributaires")
      .select("*", { count: "exact", head: true }),

    supabase
      .from("paiements")
      .select("*", { count: "exact", head: true }),
  ]);

  return {
    data: {
      lotissements: lotissements.count ?? 0,
      lots: lots.count ?? 0,
      attributaires: attributaires.count ?? 0,
      paiements: paiements.count ?? 0,
    },
    error:
      lotissements.error ||
      lots.error ||
      attributaires.error ||
      paiements.error,
  };
}