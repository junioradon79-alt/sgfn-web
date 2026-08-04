"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { InactivityLogout } from "@/components/dashboard/InactivityLogout";
import { useProfile } from "@/hooks/useProfile";
import { accueilDuRole, routeAutorisee } from "@/lib/navigation";
import { createClient } from "@/utils/supabase/client";

/**
 * Enveloppe de toutes les routes `/dashboard/*`.
 *
 * Depuis la fin de la migration Design System (les 35 écrans rendent désormais
 * leur propre chrome via `AppShell`), ce composant ne porte plus de barre
 * latérale ni d'en-tête : il ne reste que ses responsabilités transverses.
 *
 *  1. **Garde d'authentification côté client** — indispensable en export
 *     statique où le middleware (proxy.ts) ne s'exécute jamais. Le RLS protège
 *     les données, mais c'est ici qu'on bloque l'accès visuel sans session.
 *  2. **Garde de route par rôle** — `ROLE_NAV_ORDER` décrivait la liste fermée
 *     de chaque rôle mais ne bornait que le MENU : en tapant l'URL à la main, un
 *     collaborateur ouvrait `/dashboard/administration` ou
 *     `/dashboard/collaborateurs` en entier, boutons d'écriture compris (constaté
 *     au navigateur le 03/08). Aucune donnée ne fuyait — la RLS tient — mais
 *     l'écran proposait des gestes que le serveur refuse. Voir `routeAutorisee`
 *     pour le périmètre exact et ses limites.
 *  3. **Déconnexion automatique après inactivité** (`InactivityLogout`), commune
 *     à tous les rôles.
 */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, loading: profilEnCours } = useProfile();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      if (!session) {
        router.replace("/login");
        return;
      }
      setAuthChecked(true);
    });

    // Réagit à une déconnexion (ou expiration de session) en temps réel.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router]);

  // Le rôle est connu et la route lui est fermée : on renvoie sur son espace.
  const groupe = profile?.groupe ?? null;
  const routeFermee = !profilEnCours && !!groupe && !routeAutorisee(groupe, pathname);

  useEffect(() => {
    if (!routeFermee) return;
    const accueil = accueilDuRole(groupe);
    // Filet anti-boucle : si l'espace du rôle était lui-même hors de sa liste,
    // la redirection se rejouerait sans fin. Aucun rôle n'est dans ce cas
    // aujourd'hui (les huit listes fermées contiennent leur propre accueil),
    // mais une liste future mal réglée doit dégrader en laissant passer, pas en
    // bouclant.
    if (!routeAutorisee(groupe, accueil)) return;
    router.replace(accueil);
  }, [routeFermee, groupe, router]);

  // Écran d'attente pendant la vérification de session (évite le flash du dashboard).
  // Rendu hors du sous-arbre thémé d'AppShell : il s'affiche donc toujours en clair.
  // Couvre aussi le chargement du profil et la redirection d'une route fermée :
  // sans cela, l'écran interdit s'afficherait le temps d'un aller-retour — ce que
  // la garde existe précisément pour éviter.
  if (!authChecked || profilEnCours || routeFermee) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm font-medium">Vérification de la session…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="print:h-auto">
      {/* Déconnexion automatique après inactivité (tous rôles). */}
      <InactivityLogout />
      {children}
    </div>
  );
}
