"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export type PublicStats = {
  lots: number;
  attributions: number;
  attributaires: number;
  documents: number;
  pv_famille: number;
};

export type Lotissement = { id: string; nom: string };

/**
 * Données publiques du Site Vitrine — lues avec la clé **anon**, donc soumises
 * aux mêmes RLS qu'un visiteur non connecté.
 *
 * Principe du DS (§1) : l'écran ne montre que ce que la base contient. Ces
 * chiffres sont donc les vrais (`get_public_stats`, RPC SECURITY DEFINER qui est
 * le seul agrégat public sanctionné), pas les valeurs d'illustration du handoff.
 *
 * Le petit retry couvre le « fetch failed » à froid du réseau NAT64 du poste
 * (cf. connectivite_dns_securise_chrome) ; en cas d'échec persistant on rend
 * `stats = null` et l'UI affiche « — » plutôt qu'un chiffre inventé.
 */
export function usePublicStats() {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [lotissements, setLotissements] = useState<Lotissement[]>([]);
  const [ilots, setIlots] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let alive = true;

    (async () => {
      let data: PublicStats | null = null;
      for (let i = 0; i < 3 && alive; i++) {
        const r = await supabase.rpc("get_public_stats");
        if (!r.error) {
          data = r.data as PublicStats;
          break;
        }
        if (!/fetch failed/i.test(r.error.message)) break;
        await new Promise((z) => setTimeout(z, 700));
      }
      if (!alive) return;
      if (data) setStats(data);

      const [lot, il] = await Promise.all([
        supabase.from("lotissements").select("id,nom").order("nom"),
        supabase.from("ilots").select("*", { count: "exact", head: true }),
      ]);
      if (!alive) return;
      if (lot.data) setLotissements(lot.data as Lotissement[]);
      if (typeof il.count === "number") setIlots(il.count);
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, []);

  return { stats, lotissements, ilots, loading };
}
