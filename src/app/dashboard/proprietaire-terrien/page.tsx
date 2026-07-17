"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Home } from "lucide-react";
import type { Profile } from "@/components/dashboard/chefferie/types";
import { LoadingScreen } from "@/components/dashboard/chefferie/SharedUI";
import { ProprietaireTerrienView } from "@/components/dashboard/proprietaire-terrien/ProprietaireTerrienView";

// ─── Espace Propriétaire terrien ──────────────────────────────────────────────
// Espace de TOUT détenteur de premier niveau — celui qui tient son droit de la
// chaîne coutumière (guide de répartition), qu'il soit chef de famille ou non.
// Le propriétaire par achat relève de /dashboard/proprietaire (rôle `proprietaire`).
//
// Deux rattachements ouvrent l'espace, et un compte peut avoir les deux :
//   • `attributaire_id` → ses lots en nom propre (le cas majoritaire) ;
//   • `famille_id`      → l'APFC, les PV et les lots du collectif de la lignée.
// Exiger une famille, comme avant, fermait la porte à la majorité des détenteurs.

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

  if (!profile?.famille_id && !profile?.attributaire_id) {
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
            Votre compte n&apos;est encore rattaché à aucun patrimoine foncier.
            Contactez l&apos;administration SGNF pour finaliser le provisionnement.
          </p>
        </div>
      </div>
    );
  }

  return <ProprietaireTerrienView profile={profile} />;
}
