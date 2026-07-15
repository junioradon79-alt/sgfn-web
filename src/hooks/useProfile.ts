"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export type UserProfile = {
  id: string;
  nom_complet: string;
  groupe: string;
  telephone: string | null;
  attributaire_id: string | null;
  commissaire_id: string | null;
  geometre_id: string | null;
  actif: boolean;
};

export function useProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let annule = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!annule) setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("id, nom_complet, groupe, telephone, attributaire_id, commissaire_id, geometre_id, actif")
        .eq("id", user.id)
        .single();
      // Un montage/démontage rapide (StrictMode en dev, changement de page) ne
      // doit pas laisser une réponse tardive écraser un état plus récent.
      if (annule) return;
      setProfile(data);
      setLoading(false);
    })();
    return () => {
      annule = true;
    };
  }, []);

  return {
    profile,
    loading,
    isAdmin: profile?.groupe === "admin",
    isCommissaire: profile?.groupe === "commissaire",
    isGeometre: profile?.groupe === "geometre",
  };
}
