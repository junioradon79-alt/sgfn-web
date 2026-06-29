"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Map,
  Boxes,
  Users,
  FileWarning,
  FileText,
  Cpu,
  MailOpen,
  MessageSquare,
  Link2,
  Landmark,
  Compass,
  ShieldCheck,
  HandCoins,
  Sparkles,
} from "lucide-react";
import React from "react";
import { useProfile } from "@/hooks/useProfile";

interface SidebarNavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  /**
   * Groupes autorisés à voir cet item (valeurs de l'enum `groupe_utilisateur`).
   * Omis = visible par tous les utilisateurs connectés. `admin` voit tout dans tous les cas.
   * ⚠️ Matrice de départ à ajuster selon les règles métier réelles.
   */
  roles?: string[];
}

interface SidebarProps {
  /** Appelé au clic sur un lien — sert à fermer le drawer sur mobile. */
  onNavigate?: () => void;
}

const navItems: SidebarNavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: <LayoutDashboard className="w-4 h-4" />,
    // visible par tous
  },
  {
    label: "Mon espace",
    href: "/dashboard/proprietaire",
    icon: <Landmark className="w-4 h-4" />,
    roles: ["proprietaire", "acquereur"],
  },
  {
    label: "Acquérir un lot",
    href: "/dashboard/acquisition",
    icon: <Compass className="w-4 h-4" />,
    roles: ["acquereur", "amenageur"],
  },
  {
    label: "Supervision",
    href: "/dashboard/commissaire",
    icon: <ShieldCheck className="w-4 h-4" />,
    roles: ["commissaire", "verificateur"],
  },
  {
    label: "Mon activité",
    href: "/dashboard/operateur",
    icon: <HandCoins className="w-4 h-4" />,
    roles: ["operateur"],
  },
  {
    label: "Lotissements",
    href: "/lotissements",
    icon: <Map className="w-4 h-4" />,
    roles: ["operateur", "amenageur", "geometre", "chefferie", "verificateur"],
  },
  {
    label: "Lots",
    href: "/dashboard/lots",
    icon: <Boxes className="w-4 h-4" />,
    roles: ["operateur", "amenageur", "geometre", "chefferie", "verificateur", "commissaire"],
  },
  {
    label: "Attributaires",
    href: "/dashboard/attributaires",
    icon: <Users className="w-4 h-4" />,
    roles: ["operateur", "amenageur", "chefferie", "verificateur", "commissaire"],
  },
  {
    label: "Attributions",
    href: "/dashboard/attributions",
    icon: <Link2 className="w-4 h-4" />,
    roles: ["operateur", "amenageur", "chefferie", "verificateur", "commissaire"],
  },
  {
    label: "Litiges",
    href: "/dashboard/litiges",
    icon: <FileWarning className="w-4 h-4" />,
    roles: ["commissaire", "verificateur", "chefferie"],
  },
  {
    label: "Documents",
    href: "/dashboard/documents",
    icon: <FileText className="w-4 h-4" />,
    // visible par tous
  },
  {
    label: "Messages",
    href: "/dashboard/messages",
    icon: <MessageSquare className="w-4 h-4" />,
    // visible par tous : canal d'échange partagé entre l'agence et les profils
  },
  {
    label: "Invitations",
    href: "/dashboard/invitations",
    icon: <MailOpen className="w-4 h-4" />,
    roles: ["operateur", "amenageur", "chefferie"],
  },
  {
    label: "SGFN AI",
    href: "/dashboard/ia",
    icon: <Sparkles className="w-4 h-4" />,
    roles: ["verificateur", "agent_ia", "geometre"],
  },
];

export function Sidebar({ onNavigate }: SidebarProps = {}) {
  const pathname = usePathname();
  const { profile, loading } = useProfile();
  const groupe = profile?.groupe ?? null;

  // Filtrage par rôle : l'admin voit tout ; pendant le chargement on affiche tout
  // (évite un flash de menu vide) ; un item sans `roles` est visible par tous.
  const visibleItems = navItems.filter((item) => {
    if (loading || !groupe || groupe === "admin") return true;
    if (!item.roles) return true;
    return item.roles.includes(groupe);
  });

  return (
    <div
      className="flex h-full flex-col"
      style={{ fontFamily: "Inter, sans-serif" }}
    >
      {/* Logo & Title */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-100/90">
        <div className="w-8 h-8 rounded-lg bg-[#0D3B66] flex items-center justify-center p-[2px] shadow-sm">
          <div className="bg-white w-full h-full rounded-lg flex items-center justify-center overflow-hidden">
            <Image
              src="/logo-officiel.png"
              alt="SGFN Logo"
              width={23}
              height={23}
              className="object-contain"
              priority
            />
          </div>
        </div>
        <span className="text-sm font-extrabold tracking-tight text-[#0D3B66] uppercase">
          SGFN
        </span>
      </div>
      {/* Navigation */}
      <nav className="flex-1 py-6">
        <ul className="flex flex-col gap-1">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
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
                  <span>{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}