"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Sidebar } from "@/components/ui/Sidebar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Backdrop sombre (mobile uniquement) */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* Sidebar : drawer coulissant sur mobile, colonne fixe sur lg+ */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 shrink-0
          bg-white border-r border-slate-200/60
          transform transition-transform duration-200 ease-out
          lg:static lg:translate-x-0
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
      <div className="flex h-full min-w-0 flex-1 flex-col bg-[#F8FAFC]">
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200/60 bg-white px-4 sm:px-6 lg:px-8 z-30">
          <div className="flex min-w-0 items-center gap-3">
            {/* Hamburger (mobile) */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 lg:hidden"
              aria-label="Ouvrir le menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            {/* Fil d'Ariane */}
            <nav aria-label="Breadcrumb" className="min-w-0">
              <ol className="flex items-center space-x-1 text-xs text-slate-500 select-none">
                <li className="font-medium text-slate-400/90">SGFN</li>
                <li>
                  <span className="mx-2 text-slate-300">/</span>
                </li>
                <li className="font-semibold text-slate-700">Dashboard</li>
              </ol>
            </nav>
          </div>
          {/* Profil utilisateur */}
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 font-bold text-slate-700 transition hover:bg-slate-200 focus:outline-none"
            title="Mon profil"
          >
            <span className="select-none text-sm">AB</span>
          </button>
        </header>

        {/* Contenu applicatif principal */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
