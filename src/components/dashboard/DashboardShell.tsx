"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Loader2, Menu, Search, UserRound, X } from "lucide-react";
import { Sidebar } from "@/components/ui/Sidebar";
import { InactivityLogout } from "@/components/dashboard/InactivityLogout";
import { createClient } from "@/utils/supabase/client";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Garde d'authentification côté client : indispensable car en export statique
  // le middleware (proxy.ts) ne s'exécute jamais. Le RLS protège les données,
  // mais c'est ici qu'on bloque l'accès visuel au dashboard sans session.
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
  if (!authChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm font-medium">Vérification de la session…</span>
        </div>
      </div>
    );
  }

  // Écrans déjà migrés sur le Design System (`AppShell`) : ils fournissent leur
  // propre chrome (barre latérale + en-tête), on n'empile pas l'historique
  // par-dessus. Liste volontairement close — les ~25 autres pages `/dashboard/*`
  // gardent le chrome historique jusqu'à leur migration (cf. docs/DESIGN_SYSTEM.md §9).
  //
  // La barre oblique finale n'est pas cosmétique : `trailingSlash: true`
  // (next.config.ts) fait que `usePathname()` renvoie « /dashboard/geometre/ ».
  // Comparer sans la normaliser affichait deux barres latérales et deux
  // en-têtes superposés.
  const ECRANS_DS = [
    "/dashboard",
    "/dashboard/geometre",
    "/dashboard/missions",
    "/dashboard/demarches",
    // Nés directement sur le DS (rubriques Statistiques et Administration du
    // handoff) : ils n'ont jamais eu de version « chrome historique ».
    "/dashboard/statistiques",
    "/dashboard/administration",
    "/dashboard/operateur",
    "/dashboard/proprietaire-terrien",
    "/dashboard/commissaire",
    "/dashboard/chefferie",
    "/dashboard/saisie",
    "/dashboard/lots",
    "/dashboard/consultations-qr",
    "/dashboard/validations",
    "/dashboard/ilots",
    "/dashboard/attributions",
    "/dashboard/profil",
    "/dashboard/carte",
    "/dashboard/contacts-marketplace",
    "/dashboard/litiges",
    "/dashboard/ia",
  ];
  if (ECRANS_DS.includes(pathname.replace(/\/+$/, ""))) {
    return (
      <div className="print:h-auto">
        <InactivityLogout />
        {children}
      </div>
    );
  }

  const pageTitles: Record<string, string> = {
    "/dashboard": "Tableau de bord",
    "/dashboard/lots": "Gestion des lots",
    "/dashboard/documents": "Documents",
    "/dashboard/paiements": "Paiements",
    "/dashboard/messages": "Messages",
    "/dashboard/profil": "Profil et support",
  };
  const pageTitle = pageTitles[pathname] ?? "Espace de travail";

  return (
    <div className="flex h-screen overflow-hidden print:h-auto print:overflow-visible">
      {/* Déconnexion automatique après inactivité (tous rôles). */}
      <InactivityLogout />

      {/* Backdrop sombre (mobile uniquement) */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* Sidebar : drawer coulissant sur mobile, colonne fixe sur lg+ (masquée à l'impression) */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 shrink-0
          bg-white border-r border-slate-200/60
          transform transition-transform duration-200 ease-out
          lg:static lg:translate-x-0
          print:hidden
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Bouton fermeture (mobile) */}
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="absolute right-3 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 lg:hidden"
          aria-label="Fermer le menu"
        >
          <X className="h-5 w-5" />
        </button>
        <Sidebar onNavigate={() => setMobileOpen(false)} />
      </aside>

      {/* Zone de droite */}
      <div className="flex h-full min-w-0 flex-1 flex-col bg-[#F8FAFC] print:h-auto">
        {/* Header (masqué à l'impression) */}
        <header className="print:hidden z-30 flex h-[72px] shrink-0 items-center justify-between gap-3 border-b border-[#E3E8EF] bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            {/* Hamburger (mobile) */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 lg:hidden"
              aria-label="Ouvrir le menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            {/* Fil d'Ariane */}
            <nav aria-label="Breadcrumb" className="min-w-0">
              <ol className="flex items-center space-x-1 text-xs text-slate-500 select-none">
                <li className="font-bold uppercase tracking-[0.12em] text-[#0F5E8C]">SGNF</li>
                <li>
                  <span className="mx-2 text-slate-300">/</span>
                </li>
                <li className="font-semibold text-[#172033]">{pageTitle}</li>
              </ol>
            </nav>
          </div>
          <div className="flex items-center gap-1.5">
            <Link href="/dashboard/lots" className="hidden h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 sm:inline-flex" title="Rechercher dans les lots"><Search className="h-4 w-4" /> Rechercher</Link>
            <Link href="/dashboard/messages" className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100" aria-label="Ouvrir les messages"><Bell className="h-5 w-5" /></Link>
            <Link href="/dashboard/profil" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#E3E8EF] bg-white text-[#0B2E4F] transition hover:bg-slate-50" aria-label="Ouvrir mon profil"><UserRound className="h-5 w-5" /></Link>
          </div>
        </header>

        {/* Contenu applicatif principal */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 print:overflow-visible print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
