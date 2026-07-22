"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

import { createClient } from "@/utils/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useAdminOverview } from "@/hooks/useAdminOverview";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { useAncreFocus } from "@/hooks/useAncreFocus";
import { stagger } from "@/lib/motion";

import { AppShell } from "@/components/pilotage/AppShell";
import { KpiRow } from "@/components/pilotage/KpiRow";
import { TerritoryMap } from "@/components/pilotage/TerritoryMap";
import { AlertCenter } from "@/components/pilotage/AlertCenter";
import { ActivityCenter } from "@/components/pilotage/ActivityCenter";
import { WorkQueues } from "@/components/pilotage/WorkQueues";
import { QuickActions } from "@/components/pilotage/QuickActions";
import { AduDialog } from "@/components/pilotage/AduDialog";

/**
 * Centre National de Pilotage du Foncier.
 *
 * Routage par rôle : à l'arrivée sur /dashboard, chaque groupe est redirigé vers
 * son espace. Les groupes absents de cette table (admin, agent_ia…)
 * restent sur le Centre de pilotage ci-dessous.
 */
/** Ancres des sous-entrées « Pilotage » de la barre latérale (cf. `?focus=`). */
const ANCRES = ["alertes", "activite"] as const;

const ROLE_HOME: Record<string, string> = {
  // « Propriétaire » (par achat) déprécié → fondu dans proprietaire_terrien ;
  // filet de sécurité si un compte legacy subsiste.
  proprietaire: "/dashboard/proprietaire-terrien",
  acquereur: "/dashboard/mon-achat",
  // « Aménageur » fusionné dans « opérateur » : filet de sécurité si un compte
  // legacy `amenageur` subsiste — il atterrit sur l'espace opérateur.
  amenageur: "/dashboard/operateur",
  operateur: "/dashboard/operateur",
  commissaire: "/dashboard/commissaire",
  verificateur: "/dashboard/commissaire",
  chefferie: "/dashboard/chefferie",
  proprietaire_terrien: "/dashboard/proprietaire-terrien",
  operateur_saisie: "/dashboard/saisie",
  geometre: "/dashboard/geometre",
};

/**
 * L'écran répond à quatre questions, dans cet ordre — c'est son plan de lecture :
 *
 *   1. Où en est le patrimoine ?      → KpiRow
 *   2. Où est-il, physiquement ?      → TerritoryMap (composant principal)
 *   3. Qu'est-ce qui brûle ?          → AlertCenter, en regard de la carte
 *   4. Que s'est-il passé ?           → ActivityCenter
 *   5. Que puis-je créer ?            → QuickActions
 *   6. Que dois-je arbitrer ?         → WorkQueues
 *
 * Toutes les données viennent d'un seul hook (`useAdminOverview`) : deux
 * chiffres de cet écran ne peuvent pas se contredire.
 */
export default function CentrePilotagePage() {
  const router = useRouter();
  const { profile, loading: profileLoading } = useProfile();

  // Cible de redirection selon le rôle (null = reste sur le Centre de pilotage).
  const redirectTo = !profileLoading && profile?.groupe ? ROLE_HOME[profile.groupe] ?? null : null;

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  // On ne charge rien tant que le rôle n'est pas tranché : inutile d'interroger
  // la base pour un utilisateur qu'on s'apprête à rediriger ailleurs.
  const actif = !profileLoading && !redirectTo;

  const overview = useAdminOverview(actif);
  const { counts, refresh: refreshBadges } = useBadgeCounts();
  const supabase = useMemo(() => createClient(), []);
  // Sous-entrées « Centre d'alertes » / « Activité temps réel » : amène la
  // section visée à l'écran quand on arrive via `?focus=`.
  useAncreFocus(ANCRES);

  const [aduOuvert, setAduOuvert] = useState(false);
  const [genererEnCours, setGenererEnCours] = useState(false);
  const [genererErreur, setGenererErreur] = useState<string | null>(null);

  const { refresh: refreshOverview } = overview;
  const rafraichir = useCallback(() => {
    refreshOverview();
    refreshBadges();
  }, [refreshOverview, refreshBadges]);

  // Rattrapage : génère l'attestation gratuite des lots dont l'attribution
  // rang 1 est éligible mais n'en a jamais reçu (imports faits trigger désactivé).
  // Rejoue exactement la règle du trigger, via generer_attestations_gratuites_manquantes().
  const genererAttestations = useCallback(async () => {
    setGenererEnCours(true);
    setGenererErreur(null);
    const { error } = await supabase.rpc("generer_attestations_gratuites_manquantes");
    setGenererEnCours(false);
    if (error) {
      setGenererErreur(error.message);
      return;
    }
    rafraichir();
  }, [supabase, rafraichir]);

  if (profileLoading || redirectTo) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F7F9FC]">
        <span className="text-sm font-medium text-slate-400">Ouverture de votre espace…</span>
      </div>
    );
  }

  return (
    <>
      <AppShell
        wide
        loading={overview.loading}
        majLe={overview.majLe}
        counts={counts}
        onRefresh={rafraichir}
        onNouveauDossier={() => setAduOuvert(true)}
      >
        <KpiRow
          patrimoine={overview.patrimoine}
          couverture={overview.couverture}
          actes={overview.actes}
          recettes={overview.recettes}
          files={overview.files}
          loading={overview.loading}
        />

        <motion.div variants={stagger(0.08, 0.06)} initial="hidden" animate="show" className="flex flex-col gap-5">
          {/* Composant principal : la seule vue qui répond à « où ? ». Le centre
              d'alertes l'accompagne — ce qui brûle se lit à côté de la carte. */}
          {/* `grid-cols-[minmax(0,1fr)]` dès la base, et pas seulement en `xl` :
              sans gabarit explicite, la grille retombe sous `xl` sur une colonne
              implicite `auto`, dont le plancher est le `min-content`. Le contenu
              le plus large l'emportait — les onglets du Centre d'activité —
              et poussait la page 262 px hors de l'écran sur un téléphone. */}
          <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1.62fr)_minmax(0,1fr)] xl:items-start">
            <TerritoryMap
              couverture={overview.couverture}
              totalLots={overview.patrimoine.lots}
              loading={overview.loading}
            />
            <div id="alertes" className="scroll-mt-24">
              <AlertCenter
                files={overview.files}
                recettes={overview.recettes}
                marketplaceARebuild={(counts.marketplace ?? 0) > 0}
                loading={overview.loading}
                onGenererAttestations={genererAttestations}
                genererAttestationsEnCours={genererEnCours}
              />
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1.62fr)_minmax(0,1fr)] xl:items-start">
            <div id="activite" className="min-w-0 scroll-mt-24">
              <ActivityCenter activite={overview.activite} loading={overview.loading} />
            </div>
            <QuickActions onNouveauDossier={() => setAduOuvert(true)} />
          </div>

          <WorkQueues
            files={overview.files}
            recettes={overview.recettes}
            loading={overview.loading}
            onNouveauDossier={() => setAduOuvert(true)}
          />
        </motion.div>

        {overview.error && (
          <p role="alert" className="rounded-lg border border-danger/30 bg-danger-subtle px-4 py-2.5 text-[13px] text-danger">
            Certaines données n&apos;ont pas pu être chargées : {overview.error}
          </p>
        )}

        {genererErreur && (
          <p role="alert" className="rounded-lg border border-danger/30 bg-danger-subtle px-4 py-2.5 text-[13px] text-danger">
            Échec de la génération des attestations : {genererErreur}
          </p>
        )}
      </AppShell>

      <AduDialog open={aduOuvert} onOpenChange={setAduOuvert} onCreated={rafraichir} />
    </>
  );
}
