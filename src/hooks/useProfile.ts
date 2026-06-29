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
  actif: boolean;
};

export function useProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("id, nom_complet, groupe, telephone, attributaire_id, commissaire_id, actif")
        .eq("id", user.id)
        .single();
      setProfile(data);
      setLoading(false);
    })();
  }, []);

  return {
    profile,
    loading,
    isAdmin: profile?.groupe === "admin",
    isCommissaire: profile?.groupe === "commissaire",
  };
}
