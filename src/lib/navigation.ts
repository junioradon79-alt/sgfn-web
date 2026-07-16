import {
  Boxes,
  Briefcase,
  ClipboardCheck,
  ClipboardEdit,
  ClipboardList,
  Compass,
  Crown,
  FileText,
  FileWarning,
  HandCoins,
  Handshake,
  Home,
  Landmark,
  LayoutDashboard,
  Link2,
  MailOpen,
  Map,
  MapPinned,
  MessageSquare,
  QrCode,
  Ruler,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { SupabaseClient } from "@supabase/supabase-js";
import { actionAgenceRequise, type AgenceDemande } from "./agence-actions";

/**
 * Source unique de la navigation SGNF.
 *
 * Extrait de `components/ui/Sidebar.tsx` pour que l'ancienne barre latérale, la
 * nouvelle (Centre de pilotage) et la palette ⌘K partagent exactement les mêmes
 * règles d'accès. Une permission ne doit exister qu'à un seul endroit.
 */

export type BadgeKey = "demandes" | "saisie" | "marketplace" | "chefferieValidations" | "chefferieLitiges";

/** Regroupement affiché en sections dans la barre latérale. */
export type NavSection = "pilotage" | "registre" | "instruction" | "espaces" | "general";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  section: NavSection;
  /** Groupes autorisés. Omis = visible par tous. */
  roles?: string[];
  /** Masqué pour l'admin (espaces dédiés aux autres rôles). */
  adminHide?: boolean;
  badgeKey?: BadgeKey;
  /** Mots-clés supplémentaires pour la recherche ⌘K. */
  keywords?: string;
}

export const SECTION_LABELS: Record<NavSection, string> = {
  pilotage: "Pilotage",
  registre: "Registre foncier",
  instruction: "Instruction",
  espaces: "Mon espace",
  general: "Général",
};

export const SECTION_ORDER: NavSection[] = ["pilotage", "registre", "instruction", "espaces", "general"];

/**
 * ⚠️ Périmètre d'accès identique à l'existant : mêmes `href`, mêmes `roles`,
 * mêmes `adminHide`, mêmes `badgeKey`. Seul le regroupement en sections est
 * nouveau. Ne pas ajouter d'entrée ici sans vérifier le RLS de la page visée.
 */
export const NAV_ITEMS: NavItem[] = [
  // ── Pilotage ──
  { label: "Centre de pilotage", href: "/dashboard", icon: LayoutDashboard, section: "pilotage", keywords: "accueil tableau de bord home" },
  { label: "Carte foncière", href: "/dashboard/carte", icon: MapPinned, section: "pilotage", roles: ["geometre", "commissaire", "verificateur"], keywords: "gps parcelles géolocalisation" },
  { label: "Supervision", href: "/dashboard/commissaire", icon: ShieldCheck, section: "pilotage", roles: ["commissaire", "verificateur"] },
  { label: "SGNF AI", href: "/dashboard/ia", icon: Sparkles, section: "pilotage", roles: ["verificateur", "agent_ia", "geometre"] },

  // ── Registre foncier ──
  { label: "Lotissements", href: "/lotissements", icon: Map, section: "registre", roles: ["operateur", "amenageur", "geometre", "chefferie", "verificateur", "proprietaire_terrien"] },
  { label: "Lots", href: "/dashboard/lots", icon: Boxes, section: "registre", roles: ["operateur", "amenageur", "geometre", "verificateur", "commissaire", "proprietaire_terrien"], keywords: "parcelles terrains" },
  { label: "Attributaires", href: "/dashboard/attributaires", icon: Users, section: "registre", roles: ["operateur", "amenageur", "verificateur", "commissaire", "proprietaire_terrien"], keywords: "bénéficiaires" },
  { label: "Attributions", href: "/dashboard/attributions", icon: Link2, section: "registre", roles: ["operateur", "amenageur", "verificateur", "commissaire", "proprietaire_terrien"] },
  { label: "Familles", href: "/dashboard/familles", icon: Home, section: "registre", roles: [] },
  { label: "Dossiers ADU", href: "/dashboard/dossiers-adu", icon: ClipboardList, section: "registre", roles: ["geometre", "commissaire", "verificateur", "chefferie", "proprietaire_terrien"], keywords: "acd instruction urbanisme" },
  { label: "Géomètres-experts", href: "/dashboard/geometres", icon: Ruler, section: "registre", roles: [], keywords: "bornage numéro d'ordre cabinet" },

  // ── Instruction ──
  { label: "Demandes d'acquisition", href: "/dashboard/demandes-acquisition", icon: ClipboardCheck, section: "instruction", roles: ["operateur"], badgeKey: "demandes", keywords: "ventes tunnel acquéreur" },
  { label: "Saisie foncière", href: "/dashboard/saisie", icon: ClipboardEdit, section: "instruction", roles: ["operateur_saisie"], badgeKey: "saisie", keywords: "import excel validation" },
  { label: "Démarches", href: "/dashboard/demarches", icon: Ruler, section: "instruction", roles: ["geometre"], keywords: "bornage honoraires transmission mutation" },
  { label: "Litiges", href: "/dashboard/litiges", icon: FileWarning, section: "instruction", roles: ["commissaire", "verificateur", "chefferie", "proprietaire_terrien"], badgeKey: "chefferieLitiges", keywords: "conflits contentieux" },
  { label: "Concertation", href: "/dashboard/concertation", icon: Handshake, section: "instruction", roles: ["chefferie", "proprietaire", "operateur", "proprietaire_terrien"] },
  { label: "Invitations", href: "/dashboard/invitations", icon: MailOpen, section: "instruction", roles: ["operateur", "amenageur", "proprietaire_terrien"] },
  { label: "Contacts TerraCI Market", href: "/dashboard/contacts-marketplace", icon: Store, section: "instruction", roles: ["admin"], badgeKey: "marketplace", keywords: "marketplace annonces mon terrain" },
  { label: "Consultations QR", href: "/dashboard/consultations-qr", icon: QrCode, section: "instruction", roles: ["admin"], keywords: "vérification qr code" },

  // ── Espaces dédiés (masqués pour l'admin) ──
  { label: "Mon achat", href: "/dashboard/mon-achat", icon: ClipboardCheck, section: "espaces", roles: ["acquereur"], adminHide: true },
  { label: "Trouver un terrain", href: "/dashboard/acquisition", icon: Compass, section: "espaces", roles: ["acquereur", "amenageur"], adminHide: true },
  { label: "Mon espace", href: "/dashboard/proprietaire", icon: Landmark, section: "espaces", roles: ["proprietaire", "acquereur"], adminHide: true },
  { label: "Mon activité", href: "/dashboard/operateur", icon: HandCoins, section: "espaces", roles: ["operateur"], adminHide: true },
  { label: "Espace Chefferie", href: "/dashboard/chefferie", icon: Crown, section: "espaces", roles: ["chefferie"], adminHide: true, badgeKey: "chefferieValidations" },
  { label: "Propriétaire terrien", href: "/dashboard/proprietaire-terrien", icon: Home, section: "espaces", roles: ["proprietaire_terrien"], adminHide: true },
  { label: "Espace Géomètre", href: "/dashboard/geometre", icon: Ruler, section: "espaces", roles: ["geometre"], adminHide: true },
  { label: "Mes missions", href: "/dashboard/missions", icon: Briefcase, section: "espaces", roles: ["geometre"], adminHide: true },

  // ── Général ──
  { label: "Documents", href: "/dashboard/documents", icon: FileText, section: "general" },
  { label: "Messages", href: "/dashboard/messages", icon: MessageSquare, section: "general" },
];

/**
 * Ordre de sidebar personnalisé pour certains rôles — ET liste fermée : quand
 * un rôle a une entrée ici, ce sont les SEULS items affichés (dans cet ordre),
 * `roles`/`adminHide` sur `NAV_ITEMS` ne s'appliquent plus pour ce rôle. Ça
 * évite qu'un item par ailleurs global (Centre de pilotage, Messages, sans
 * `roles`) ne fuite dans un menu volontairement resserré. Absent pour un rôle
 * = comportement par défaut (filtre par `roles`, ordre = position dans
 * `NAV_ITEMS`) — donc aucun impact sur les rôles non listés ici.
 */
const ROLE_NAV_ORDER: Partial<Record<string, string[]>> = {
  geometre: [
    "/dashboard",
    "/dashboard/geometre",
    "/dashboard/missions",
    "/dashboard/demarches",
    "/dashboard/dossiers-adu",
    "/dashboard/messages",
    "/dashboard/carte",
    "/lotissements",
    "/dashboard/lots",
    "/dashboard/documents",
    "/dashboard/ia",
  ],
  // Chefferie (chef de village) : périmètre resserré à la juridiction territoriale.
  chefferie: [
    "/dashboard/chefferie",
    "/lotissements",
    "/dashboard/lots",
    "/dashboard/litiges",
    "/dashboard/dossiers-adu",
    "/dashboard/documents",
    "/dashboard/concertation",
  ],
};

/**
 * Un rôle avec un ordre personnalisé veut une liste plate, lue dans cet ordre
 * précis — pas un regroupement par section (`AppSidebar`) qui le shuffle.
 */
export function hasCustomNavOrder(groupe: string | null): boolean {
  return !!groupe && !!ROLE_NAV_ORDER[groupe];
}

/** Filtre d'accès — règles reprises telles quelles de la barre latérale historique. */
export function visibleNavItems(groupe: string | null, loading: boolean): NavItem[] {
  const order = groupe ? ROLE_NAV_ORDER[groupe] : undefined;

  const filtered = NAV_ITEMS.filter((item) => {
    if (loading || !groupe) return true;
    // Un rôle avec un ordre personnalisé (chefferie, geometre) veut une liste
    // fermée : seuls les items listés apparaissent, roles/adminHide/hideForRoles
    // ne s'appliquent plus (sinon un item par ailleurs global comme "Centre de
    // pilotage" ou "Messages" continue de fuir dans le menu).
    if (order) return order.includes(item.href);
    if (groupe === "admin") return !item.adminHide;
    // Opérateur de saisie : accès strictement limité à son module.
    if (groupe === "operateur_saisie") return item.roles?.includes("operateur_saisie") ?? false;
    if (!item.roles) return true;
    return item.roles.includes(groupe);
  });

  if (!order) return filtered;

  return [...filtered].sort((a, b) => {
    const ia = order.indexOf(a.href);
    const ib = order.indexOf(b.href);
    return (ia === -1 ? order.length : ia) - (ib === -1 ? order.length : ib);
  });
}

/**
 * Compteurs d'actions à faire (pastilles rouges). Agence uniquement.
 * Rouge = « c'est à nous de jouer », jamais « on attend le client ».
 */
export async function fetchBadgeCounts(
  supabase: SupabaseClient,
  groupe: string | null,
): Promise<Partial<Record<BadgeKey, number>>> {
  const next: Partial<Record<BadgeKey, number>> = {};

  // Chefferie (chef de village) : signaux "à valider" — RLS déjà scopée par juridiction
  // (ma_chefferie_id()), aucun filtre manuel nécessaire côté client.
  if (groupe === "chefferie") {
    const [{ count: cessions }, { count: apfcs }, { count: litiges }] = await Promise.all([
      supabase.from("attestations_cession").select("id", { count: "exact", head: true }).is("sig_chefferie_le", null),
      supabase.from("attestations_coutumieres").select("id", { count: "exact", head: true }).is("sig_chef_village_le", null),
      supabase.from("litiges").select("id", { count: "exact", head: true }).neq("statut", "clos"),
    ]);
    next.chefferieValidations = (cessions ?? 0) + (apfcs ?? 0);
    next.chefferieLitiges = litiges ?? 0;
    return next;
  }

  const estAgence = groupe === "admin" || groupe === "operateur";
  if (!estAgence) return next;

  const { data } = await supabase
    .from("demandes_acquisition_agence")
    .select("statut,vente_id,vente_statut,vente_paiement_statut,cession_id,paiement_statut,attestation_reference");
  next.demandes = ((data ?? []) as AgenceDemande[]).filter(actionAgenceRequise).length;

  // La file de validation de la saisie est réservée à l'admin (le checker).
  if (groupe === "admin") {
    const { count } = await supabase
      .from("soumissions_saisie")
      .select("id", { count: "exact", head: true })
      .eq("statut", "en_attente");
    next.saisie = count ?? 0;

    // « Site TerraCI Market à reconstruire » : une annonce a été publiée depuis le
    // dernier déploiement cPanel connu.
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
    const derniereReconstruction = (etat as { derniere_reconstruction: string | null } | null)?.derniere_reconstruction ?? null;
    const dernierePublication = (derniere as { publiee_le: string | null } | null)?.publiee_le ?? null;
    next.marketplace =
      dernierePublication && (!derniereReconstruction || dernierePublication > derniereReconstruction) ? 1 : 0;
  }

  return next;
}
