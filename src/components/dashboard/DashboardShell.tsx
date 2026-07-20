"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { InactivityLogout } from "@/components/dashboard/InactivityLogout";
import { createClient } from "@/utils/supabase/client";

/**
 * Enveloppe de toutes les routes `/dashboard/*`.
 *
 * Depuis la fin de la migration Design System (les 35 écrans rendent désormais
 * leur propre chrome via `AppShell`), ce composant ne porte plus de barre
 * latérale ni d'en-tête : il ne reste que ses deux responsabilités transverses.
 *
 *  1. **Garde d'authentification côté client** — indispensable en export
 *     statique où le middleware (proxy.ts) ne s'exécute jamais. Le RLS protège
 *     les données, mais c'est ici qu'on bloque l'accès visuel sans session.
 *  2. **Déconnexion automatique après inactivité** (`InactivityLogout`), commune
 *     à tous les rôles.
 */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
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

  // Écran d'attente pendant la vérification de session (évite le flash du dashboard).
  // Rendu hors du sous-arbre thémé d'AppShell : il s'affiche donc toujours en clair.
  if (!authChecked) {
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
