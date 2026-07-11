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
  ClipboardCheck,
  Crown,
  Handshake,
  MapPinned,
  Store,
  QrCode,
  ClipboardEdit,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { useProfile } from "@/hooks/useProfile";
import { createClient } from "@/utils/supabase/client";
import { actionAgenceRequise, type AgenceDemande } from "@/lib/agence-actions";

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
  /** Clé de compteur d'actions à faire (badge rouge). */
  badgeKey?: "demandes" | "saisie" | "marketplace";
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
    label: "Mon achat",
    href: "/dashboard/mon-achat",
    icon: <ClipboardCheck className="w-4 h-4" />,
    roles: ["acquereur"],
    adminHide: true,
  },
  {
    label: "Trouver un terrain",
    href: "/dashboard/acquisition",
    icon: <Compass className="w-4 h-4" />,
    roles: ["acquereur", "amenageur"],
    adminHide: true,
  },
  {
    label: "Mon espace",
    href: "/dashboard/proprietaire",
    icon: <Landmark className="w-4 h-4" />,
    roles: ["proprietaire", "acquereur"],
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
    label: "Saisie foncière",
    href: "/dashboard/saisie",
    icon: <ClipboardEdit className="w-4 h-4" />,
    // opérateur de saisie (seul item qu'il voit) ; admin y accède aussi (file de validation).
    roles: ["operateur_saisie"],
    badgeKey: "saisie", // admin : nb de soumissions en attente de validation
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
    label: "Demandes d'acquisition",
    href: "/dashboard/demandes-acquisition",
    icon: <ClipboardCheck className="w-4 h-4" />,
    roles: ["operateur"],
    badgeKey: "demandes",
    // admin voit aussi (pas de adminHide)
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
    badgeKey: "marketplace", // site monterrain-web à reconstruire après publication
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

  // Compteurs d'actions à faire (badges rouges). Agence uniquement.
  const [counts, setCounts] = useState<Record<string, number>>({});
  const estAgence = groupe === "admin" || groupe === "operateur";

  const refreshCounts = useCallback(async () => {
    if (!estAgence) {
      setCounts({});
      return;
    }
    const supabase = createClient();
    const next: Record<string, number> = {};
    const { data } = await supabase
      .from("demandes_acquisition_agence")
      .select("statut,vente_id,vente_statut,vente_paiement_statut,cession_id,paiement_statut,attestation_reference");
    const demandes = (data ?? []) as AgenceDemande[];
    next.demandes = demandes.filter(actionAgenceRequise).length;
    // Badge « à valider » du module de saisie : réservé à l'admin (le checker).
    if (groupe === "admin") {
      const { count } = await supabase
        .from("soumissions_saisie")
        .select("id", { count: "exact", head: true })
        .eq("statut", "en_attente");
      next.saisie = count ?? 0;

      // Badge « site Mon Terrain à reconstruire » : une annonce a été
      // publiée/modifiée depuis le dernier déploiement cPanel connu.
      const [{ data: etat }, { data: derniere }] = await Promise.all([
        supabase.from("marketplace_etat_site").select("derniere_reconstruction").maybeSingle(),
        supabase
          .from("annonces_marketplace")
          .select("publiee_le")
          .eq("statut", "active")
          .order("publiee_le", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      const derniereReconstruction = etat?.derniere_reconstruction ?? null;
      const dernierePublication = derniere?.publiee_le ?? null;
      next.marketplace =
        dernierePublication && (!derniereReconstruction || dernierePublication > derniereReconstruction) ? 1 : 0;
    }
    setCounts(next);
  }, [estAgence, groupe]);

  useEffect(() => {
    void (async () => {
      await refreshCounts();
    })();
  }, [refreshCounts, pathname]);

  // Rafraîchissement immédiat après une action agence (event émis par les pages).
  useEffect(() => {
    const h = () => void refreshCounts();
    window.addEventListener("sgnf:refresh-badges", h);
    return () => window.removeEventListener("sgnf:refresh-badges", h);
  }, [refreshCounts]);

  const visibleItems = navItems.filter((item) => {
    if (loading || !groupe) return true;
    if (groupe === "admin") return !item.adminHide;
    // Opérateur de saisie : accès strictement limité à son module.
    if (groupe === "operateur_saisie") return item.roles?.includes("operateur_saisie") ?? false;
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
            const badge = item.badgeKey ? counts[item.badgeKey] ?? 0 : 0;
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
                    {item.icon}
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