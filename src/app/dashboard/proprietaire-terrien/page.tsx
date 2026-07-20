"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Home } from "lucide-react";
import type { Profile } from "@/components/dashboard/chefferie/types";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { AppShell } from "@/components/pilotage/AppShell";
import { EmptyState } from "@/components/ds/empty-state";
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
  const { counts } = useBadgeCounts();

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

  // Le profil n'est pas encore lu, ou le compte n'est rattaché à aucun
  // patrimoine : dans les deux cas c'est la page qui porte la coquille, la vue
  // n'ayant rien à afficher.
  if (loading || (!profile?.famille_id && !profile?.attributaire_id)) {
    return (
      <AppShell loading={loading} counts={counts} onRefresh={() => window.location.reload()}>
        {loading ? (
          <div className="flex min-h-[320px] items-center justify-center">
            <span className="text-[13px] font-medium text-muted-2">Chargement de votre patrimoine…</span>
          </div>
        ) : (
          <EmptyState
            icon={Home}
            title="Compte en cours de provisionnement"
            description="Votre compte n'est encore rattaché à aucun patrimoine foncier. Contactez l'administration SGNF pour finaliser le provisionnement."
          />
        )}
      </AppShell>
    );
  }

  return <ProprietaireTerrienView profile={profile} counts={counts} />;
}
