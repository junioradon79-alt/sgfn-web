"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import React from "react";

import { useProfile } from "@/hooks/useProfile";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import { visibleNavItems } from "@/lib/navigation";

interface SidebarProps {
  /** Appelé au clic sur un lien — sert à fermer le drawer sur mobile. */
  onNavigate?: () => void;
}

/**
 * Barre latérale historique — utilisée par toutes les pages `/dashboard/*`
 * hors Centre de pilotage (qui monte son propre shell, cf. `pilotage/AppShell`).
 *
 * La configuration (items, rôles, pastilles) vit désormais dans
 * `@/lib/navigation` : elle est partagée avec la nouvelle barre latérale et la
 * palette ⌘K, pour qu'une règle d'accès n'existe qu'à un seul endroit.
 */
export function Sidebar({ onNavigate }: SidebarProps = {}) {
  const pathname = usePathname();
  const { profile, loading } = useProfile();
  const groupe = profile?.groupe ?? null;

  const { counts } = useBadgeCounts();

  const visibleItems = visibleNavItems(groupe, loading);

  return (
    <div className="flex h-full flex-col" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Logo & Title */}
      <Link
        href="/"
        onClick={onNavigate}
        className="h-16 flex items-center gap-3 px-5 border-b border-slate-100/90 hover:bg-slate-50/60 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl bg-[#0D3B66] flex items-center justify-center p-[3px] shadow-md">
          <div className="bg-white w-full h-full rounded-lg flex items-center justify-center overflow-hidden">
            <Image src="/logo-embleme.png" alt="SGNF Logo" width={30} height={30} className="object-contain" priority />
          </div>
        </div>
        <span className="text-base font-extrabold tracking-tight text-[#0D3B66] uppercase">SGNF</span>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6">
        <ul className="flex flex-col gap-1">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const badge = item.badgeKey ? counts[item.badgeKey] ?? 0 : 0;
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={`
                    group flex items-center gap-3 px-5 py-2
                    text-[15px] rounded-md transition
                    font-medium
                    ${
                      isActive
                        ? "bg-[#0D3B66]/6 text-[#0D3B66]"
                        : "text-slate-500 hover:bg-[#0D3B66]/4 hover:text-[#0D3B66]"
                    }
                  `}
                  style={{ fontFamily: "Inter, sans-serif" }}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className="relative">
                    <Icon className="w-4 h-4" />
                    {badge > 0 && (
                      <span className="absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full bg-[#EF4444] ring-2 ring-white" />
                    )}
                  </span>
                  <span className="truncate">{item.label}</span>
                  {badge > 0 && (
                    <span className="ml-auto inline-flex min-w-[20px] items-center justify-center rounded-full bg-[#EF4444] px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">
                      {badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
