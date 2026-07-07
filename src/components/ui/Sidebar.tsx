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
  Home,
  ClipboardList,
  Crown,
  Handshake,
  MapPinned,
  Store,
  QrCode,
} from "lucide-react";
import React from "react";
import { useProfile } from "@/hooks/useProfile";

interface SidebarNavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  /**
   * Groupes autorisés à voir cet item. Omis = visible par tous.
   * `admin` voit tout SAUF les items marqués `adminHide: true`.
   */
  roles?: string[];
  /** Masquer cet item pour l'admin (espaces dédiés aux autres rôles). */
  adminHide?: boolean;
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
    adminHide: true,
  },
  {
    label: "Acquérir un lot",
    href: "/dashboard/acquisition",
    icon: <Compass className="w-4 h-4" />,
    roles: ["acquereur", "amenageur"],
    adminHide: true,
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
    adminHide: true,
  },
  {
    label: "Espace Chefferie",
    href: "/dashboard/chefferie",
    icon: <Crown className="w-4 h-4" />,
    roles: ["chefferie"],
    adminHide: true,
  },
  {
    label: "Propriétaire terrien",
    href: "/dashboard/proprietaire-terrien",
    icon: <Home className="w-4 h-4" />,
    roles: ["proprietaire_terrien"],
    adminHide: true,
  },
  {
    label: "Concertation",
    href: "/dashboard/concertation",
    icon: <Handshake className="w-4 h-4" />,
    roles: ["chefferie", "proprietaire", "operateur", "proprietaire_terrien"],
    // admin voit aussi (pas de adminHide)
  },
  {
    label: "Carte foncière",
    href: "/dashboard/carte",
    icon: <MapPinned className="w-4 h-4" />,
    roles: ["geometre", "commissaire", "verificateur"],
    // admin voit aussi (pas de adminHide)
  },
  {
    label: "Lotissements",
    href: "/lotissements",
    icon: <Map className="w-4 h-4" />,
    roles: ["operateur", "amenageur", "geometre", "chefferie", "verificateur", "proprietaire_terrien"],
  },
  {
    label: "Lots",
    href: "/dashboard/lots",
    icon: <Boxes className="w-4 h-4" />,
    roles: ["operateur", "amenageur", "geometre", "chefferie", "verificateur", "commissaire", "proprietaire_terrien"],
  },
  {
    label: "Attributaires",
    href: "/dashboard/attributaires",
    icon: <Users className="w-4 h-4" />,
    roles: ["operateur", "amenageur", "chefferie", "verificateur", "commissaire", "proprietaire_terrien"],
  },
  {
    label: "Attributions",
    href: "/dashboard/attributions",
    icon: <Link2 className="w-4 h-4" />,
    roles: ["operateur", "amenageur", "chefferie", "verificateur", "commissaire", "proprietaire_terrien"],
  },
  {
    label: "Litiges",
    href: "/dashboard/litiges",
    icon: <FileWarning className="w-4 h-4" />,
    roles: ["commissaire", "verificateur", "chefferie", "proprietaire_terrien"],
  },
  {
    label: "Contacts Mon Terrain",
    href: "/dashboard/contacts-marketplace",
    icon: <Store className="w-4 h-4" />,
    roles: ["admin"],
  },
  {
    label: "Consultations QR",
    href: "/dashboard/consultations-qr",
    icon: <QrCode className="w-4 h-4" />,
    roles: ["admin"],
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
    label: "Dossiers ADU",
    href: "/dashboard/dossiers-adu",
    icon: <ClipboardList className="w-4 h-4" />,
    roles: [],
  },
  {
    label: "Familles",
    href: "/dashboard/familles",
    icon: <Home className="w-4 h-4" />,
    roles: [],
  },
  {
    label: "Invitations",
    href: "/dashboard/invitations",
    icon: <MailOpen className="w-4 h-4" />,
    roles: ["operateur", "amenageur", "chefferie", "proprietaire_terrien"],
  },
  {
    label: "SGNF AI",
    href: "/dashboard/ia",
    icon: <Sparkles className="w-4 h-4" />,
    roles: ["verificateur", "agent_ia", "geometre"],
  },
];

export function Sidebar({ onNavigate }: SidebarProps = {}) {
  const pathname = usePathname();
  const { profile, loading } = useProfile();
  const groupe = profile?.groupe ?? null;

  const visibleItems = navItems.filter((item) => {
    if (loading || !groupe) return true;
    if (groupe === "admin") return !item.adminHide;
    if (!item.roles) return true;
    return item.roles.includes(groupe);
  });

  return (
    <div
      className="flex h-full flex-col"
      style={{ fontFamily: "Inter, sans-serif" }}
    >
      {/* Logo & Title */}
      <Link
        href="/"
        onClick={onNavigate}
        className="h-16 flex items-center gap-3 px-5 border-b border-slate-100/90 hover:bg-slate-50/60 transition-colors"
      >
        <div className="w-10 h-10 rounded-xl bg-[#0D3B66] flex items-center justify-center p-[3px] shadow-md">
          <div className="bg-white w-full h-full rounded-lg flex items-center justify-center overflow-hidden">
            <Image
              src="/logo-embleme.png"
              alt="SGNF Logo"
              width={30}
              height={30}
              className="object-contain"
              priority
            />
          </div>
        </div>
        <span className="text-base font-extrabold tracking-tight text-[#0D3B66] uppercase">
          SGNF
        </span>
      </Link>
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