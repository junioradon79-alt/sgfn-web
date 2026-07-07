"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Home } from "lucide-react";
import type { Profile } from "@/components/dashboard/chefferie/types";
import { LoadingScreen } from "@/components/dashboard/chefferie/SharedUI";
import { ChefFamilleView } from "@/components/dashboard/chefferie/ChefFamilleView";

// ─── Espace Propriétaire terrien ──────────────────────────────────────────────
// Nouveau rôle formel (groupe_utilisateur.proprietaire_terrien) qui remplace,
// pour les nouvelles familles/lotissements, le sous-rôle "chef de famille"
// jusqu'ici confondu avec la Chefferie. Réutilise ChefFamilleView, partagée
// avec /dashboard/chefferie (comptes legacy, ex. Koelea-Accor Revu) — un seul
// implémentation, deux points d'entrée qui cohabitent indéfiniment.

export default function ProprietaireTerrienPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select(
          "id, nom_complet, groupe, famille_id, autorite_coutumiere_id, attributaire_id"
        )
        .eq("id", user.id)
        .single();
      setProfile(data as Profile | null);
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoadingScreen />;

  if (!profile?.famille_id) {
    return (
      <div className="flex min-h-[300px] items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50">
            <Home className="h-6 w-6 text-teal-600" />
          </div>
          <p className="text-sm font-semibold text-slate-800">
            Compte en cours de provisionnement
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Votre compte n&apos;est pas encore rattaché à une famille. Contactez
            l&apos;administration SGNF pour finaliser le provisionnement.
          </p>
        </div>
      </div>
    );
  }

  return <ChefFamilleView profile={profile} />;
}
