import {
  BarChart3,
  Boxes,
  Briefcase,
  ClipboardCheck,
  ClipboardEdit,
  ClipboardList,
  Compass,
  CreditCard,
  Crown,
  FileText,
  FileWarning,
  FolderOpen,
  HandCoins,
  Handshake,
  Home,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  Link2,
  MailOpen,
  Map,
  MapPinned,
  MessageSquare,
  QrCode,
  Ruler,
  Settings,
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

export type BadgeKey = "demandes" | "saisie" | "marketplace" | "chefferieValidations" | "litigesActifs" | "ptAValider";

/**
 * Regroupement affiché en rubriques dans la barre latérale.
 *
 * Clés reprises du handoff (écran Pilotage). `espaces` n'y figure pas — c'est
 * l'écran Opérateur du handoff qui l'apporte (« Mon espace »), parce que seuls
 * les dashboards de rôle ont un espace dédié.
 */
export type NavSection =
  | "pilotage"
  | "cadastre"
  | "dossiers"
  | "marketplace"
  | "utilisateurs"
  | "documents"
  | "paiements"
  | "statistiques"
  | "intelligence"
  | "administration"
  | "espaces"
  | "general";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  section: NavSection;
  /**
   * Rubrique dans un dashboard de rôle, quand elle diffère de la rubrique
   * nationale. Le handoff range « Attributaires » sous Utilisateurs côté
   * Pilotage et sous Registre foncier côté Opérateur : c'est le même écran, vu
   * de deux métiers différents.
   */
  sectionRole?: NavSection;
  /**
   * Rang dans sa rubrique, côté dashboard de rôle. Un seul tableau `NAV_ITEMS`
   * ne peut pas porter deux ordres : le handoff classe « Attributaires » avant
   * « Attributions » côté Opérateur et l'inverse côté Pilotage. Sans valeur,
   * l'entrée garde sa position dans `NAV_ITEMS`, après celles qui en ont une.
   */
  ordreRole?: number;
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
  cadastre: "Cadastre",
  dossiers: "Dossiers",
  marketplace: "Marketplace",
  utilisateurs: "Utilisateurs",
  documents: "Documents",
  paiements: "Paiements",
  statistiques: "Statistiques",
  intelligence: "Intelligence",
  administration: "Administration",
  espaces: "Mon espace",
  general: "Général",
};

/**
 * Le handoff nomme deux rubriques différemment selon l'écran : « Cadastre » et
 * « Dossiers » sur le Pilotage (national), « Registre foncier » et
 * « Instruction » sur l'Opérateur (métier). Le vocabulaire suit le point de vue
 * — on garde les deux plutôt que d'en imposer un aux deux publics.
 */
export const SECTION_LABELS_ROLE: Partial<Record<NavSection, string>> = {
  cadastre: "Registre foncier",
  dossiers: "Instruction",
};

/**
 * Sous-titre du bloc de marque, sous « SGNF ».
 *
 * Le handoff donne un intitulé propre à chaque écran : la barre latérale
 * annonce *où l'on est*, pas seulement le nom du produit. Les rôles absents du
 * handoff (acquéreur, agent IA) retombent sur le libellé générique.
 */
export const ESPACE_LABELS: Record<string, string> = {
  admin: "Centre de Pilotage Foncier",
  operateur: "Espace Opérateur",
  amenageur: "Espace Opérateur", // rôle fusionné, cf. mémoire projet
  geometre: "Espace Géomètre",
  chefferie: "Espace Chefferie",
  commissaire: "Supervision",
  verificateur: "Supervision",
  proprietaire_terrien: "Propriétaire terrien",
  proprietaire: "Propriétaire terrien", // rôle déprécié, fondu dans le précédent
  operateur_saisie: "Saisie foncière",
  acquereur: "Espace Acquéreur",
};

export const libelleEspace = (groupe: string | null) =>
  (groupe && ESPACE_LABELS[groupe]) || "Espace de travail";

/** Icône d'en-tête de rubrique (handoff : chaque rubrique en porte une). */
export const SECTION_ICONS: Record<NavSection, LucideIcon> = {
  pilotage: LayoutDashboard,
  cadastre: Map,
  dossiers: FolderOpen,
  marketplace: Store,
  utilisateurs: Users,
  documents: FileText,
  paiements: CreditCard,
  statistiques: BarChart3,
  intelligence: Sparkles,
  administration: Settings,
  espaces: Compass,
  general: LayoutGrid,
};

export const SECTION_ORDER: NavSection[] = [
  "pilotage",
  "cadastre",
  "dossiers",
  "espaces",
  "marketplace",
  "utilisateurs",
  "documents",
  "paiements",
  "statistiques",
  "intelligence",
  "administration",
  "general",
];

/**
 * ⚠️ Périmètre d'accès identique à l'existant : mêmes `href`, mêmes `roles`,
 * mêmes `adminHide`, mêmes `badgeKey`. Seul le regroupement en sections est
 * nouveau. Ne pas ajouter d'entrée ici sans vérifier le RLS de la page visée.
 */
export const NAV_ITEMS: NavItem[] = [
  // ── Pilotage ──
  // Le handoff ne montre cette entrée que sur Pilotage et Géomètre. `roles: []`
  // = admin ; le géomètre la garde via sa liste fermée ROLE_NAV_ORDER.
  { label: "Centre de pilotage", href: "/dashboard", icon: LayoutDashboard, section: "pilotage", roles: [], keywords: "accueil tableau de bord home" },
  { label: "Supervision", href: "/dashboard/commissaire", icon: ShieldCheck, section: "pilotage", roles: ["commissaire", "verificateur"] },
  // Le handoff range la carte sous Cadastre et l'IA sous Intelligence.
  { label: "Carte foncière", href: "/dashboard/carte", icon: MapPinned, section: "cadastre", roles: ["geometre", "commissaire", "verificateur"], keywords: "gps parcelles géolocalisation" },
  { label: "SGNF AI", href: "/dashboard/ia", icon: Sparkles, section: "intelligence", roles: ["verificateur", "agent_ia", "geometre"] },

  // ── Cadastre (« Registre foncier » côté métier) ──
  { label: "Lotissements", href: "/lotissements", icon: Map, section: "cadastre", roles: ["operateur", "amenageur", "geometre", "chefferie", "verificateur", "proprietaire_terrien"], ordreRole: 1 },
  { label: "Îlots", href: "/dashboard/ilots", icon: LayoutGrid, section: "cadastre", roles: [], keywords: "blocs découpage périmètre" },
  { label: "Lots", href: "/dashboard/lots", icon: Boxes, section: "cadastre", roles: ["operateur", "amenageur", "geometre", "verificateur", "commissaire", "proprietaire_terrien"], keywords: "parcelles terrains", ordreRole: 2 },
  { label: "Géomètres-experts", href: "/dashboard/geometres", icon: Ruler, section: "cadastre", roles: [], keywords: "bornage numéro d'ordre cabinet" },

  // ── Dossiers (« Instruction » côté métier) ──
  { label: "Dossiers ADU", href: "/dashboard/dossiers-adu", icon: ClipboardList, section: "dossiers", roles: ["geometre", "commissaire", "verificateur", "chefferie", "proprietaire_terrien"], keywords: "acd instruction urbanisme" },
  { label: "Litiges", href: "/dashboard/litiges", icon: FileWarning, section: "dossiers", roles: ["commissaire", "verificateur", "chefferie", "proprietaire_terrien"], badgeKey: "litigesActifs", keywords: "conflits contentieux" },
  { label: "Demandes d'acquisition", href: "/dashboard/demandes-acquisition", icon: ClipboardCheck, section: "dossiers", roles: ["operateur"], badgeKey: "demandes", keywords: "ventes tunnel acquéreur", ordreRole: 1 },
  { label: "Attributions", href: "/dashboard/attributions", icon: Link2, section: "dossiers", sectionRole: "cadastre", roles: ["operateur", "amenageur", "verificateur", "commissaire", "proprietaire_terrien"], ordreRole: 4 },
  { label: "Concertation", href: "/dashboard/concertation", icon: Handshake, section: "dossiers", roles: ["chefferie", "proprietaire", "operateur", "proprietaire_terrien"], ordreRole: 3 },
  { label: "Validations", href: "/dashboard/validations", icon: ClipboardCheck, section: "dossiers", roles: [], keywords: "approbation contrôle" },
  { label: "Démarches", href: "/dashboard/demarches", icon: Ruler, section: "dossiers", roles: ["geometre"], keywords: "bornage honoraires transmission mutation" },

  // ── Marketplace ──
  { label: "Contacts TerraCI Market", href: "/dashboard/contacts-marketplace", icon: Store, section: "marketplace", roles: ["admin"], badgeKey: "marketplace", keywords: "marketplace annonces mon terrain" },

  // ── Utilisateurs ──
  { label: "Attributaires", href: "/dashboard/attributaires", icon: Users, section: "utilisateurs", sectionRole: "cadastre", roles: ["operateur", "amenageur", "verificateur", "commissaire", "proprietaire_terrien"], keywords: "bénéficiaires", ordreRole: 3 },
  { label: "Familles", href: "/dashboard/familles", icon: Home, section: "utilisateurs", roles: [], keywords: "chefferies lignages" },
  { label: "Invitations", href: "/dashboard/invitations", icon: MailOpen, section: "utilisateurs", sectionRole: "dossiers", roles: ["operateur", "amenageur", "proprietaire_terrien"], ordreRole: 2 },

  // ── Paiements ──
  { label: "Paiements", href: "/dashboard/paiements", icon: CreditCard, section: "paiements", roles: [], keywords: "transactions encaissements recettes quittances" },

  // ── Statistiques ──
  { label: "Statistiques", href: "/dashboard/statistiques", icon: BarChart3, section: "statistiques", roles: [], keywords: "rapports performance régionale analyse" },

  // ── Intelligence ──
  { label: "Saisie foncière", href: "/dashboard/saisie", icon: ClipboardEdit, section: "intelligence", roles: ["operateur_saisie"], badgeKey: "saisie", keywords: "import excel validation saisie assistée" },

  // ── Administration ──
  { label: "Administration", href: "/dashboard/administration", icon: Settings, section: "administration", roles: [], keywords: "utilisateurs système rôles permissions journal audit paramètres" },

  // ── Espaces dédiés (masqués pour l'admin) ──
  { label: "Mon espace", href: "/dashboard/mon-achat", icon: ClipboardCheck, section: "espaces", roles: ["acquereur"], adminHide: true, keywords: "acquéreur suivi terrains achat" },
  { label: "Trouver un terrain", href: "/dashboard/acquisition", icon: Compass, section: "espaces", roles: ["acquereur", "amenageur", "operateur"], adminHide: true },
  { label: "Mon espace", href: "/dashboard/proprietaire", icon: Landmark, section: "espaces", roles: ["proprietaire", "acquereur"], adminHide: true },
  { label: "Mettre en vente", href: "/dashboard/mettre-en-vente", icon: Store, section: "espaces", roles: ["proprietaire", "proprietaire_terrien"], adminHide: true, keywords: "marketplace annonce terraci market vendre terrain" },
  { label: "Mon activité", href: "/dashboard/operateur", icon: HandCoins, section: "espaces", roles: ["operateur"], adminHide: true },
  { label: "Espace Chefferie", href: "/dashboard/chefferie", icon: Crown, section: "espaces", roles: ["chefferie"], adminHide: true, badgeKey: "chefferieValidations" },
  { label: "Propriétaire terrien", href: "/dashboard/proprietaire-terrien", icon: Home, section: "espaces", roles: ["proprietaire_terrien"], adminHide: true, badgeKey: "ptAValider" },
  { label: "Espace Géomètre", href: "/dashboard/geometre", icon: Ruler, section: "espaces", roles: ["geometre"], adminHide: true },
  { label: "Mes missions", href: "/dashboard/missions", icon: Briefcase, section: "espaces", roles: ["geometre"], adminHide: true },

  // ── Documents ──
  { label: "Documents", href: "/dashboard/documents", icon: FileText, section: "documents", sectionRole: "general", keywords: "registre documentaire actes attestations" },
  { label: "Consultations QR", href: "/dashboard/consultations-qr", icon: QrCode, section: "documents", roles: ["admin"], keywords: "vérification qr code" },

  // ── Général ──
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
  // Propriétaire terrien (détenteur de premier niveau, chef de famille ou non) :
  // périmètre resserré à son patrimoine.
  proprietaire_terrien: [
    "/dashboard/proprietaire-terrien",
    "/dashboard/mettre-en-vente",
    "/dashboard/litiges",
    "/dashboard/concertation",
    "/dashboard/documents",
  ],
  // Acquéreur : espace resserré au suivi + achats. La découverte des terrains vit
  // sur TerraCI Market (site public monterrain-web), liée depuis « Mon espace ».
  // L'ancien tunnel /dashboard/acquisition et le partage /dashboard/proprietaire
  // sont volontairement retirés du menu.
  acquereur: [
    "/dashboard/mon-achat",
    "/dashboard/messages",
    "/dashboard/documents",
  ],
  // Commissaire de justice : périmètre resserré à SA supervision — uniquement les
  // lotissements dont il a légalisé les PV. La RLS scope déjà ses données
  // (registre, litiges, dossiers ADU, carte) ; on retire du menu les pages
  // « registre » génériques (Lots, Attributaires, Attributions) redondantes avec
  // son dashboard de supervision. Le VÉRIFICATEUR, lui, garde une vue nationale
  // (pas d'ordre personnalisé pour ce rôle).
  // Agent de saisie : une seule entrée. Liste plate — un intitulé de rubrique
  // au-dessus d'un unique lien n'ajoute qu'un étage de hiérarchie vide, et le
  // handoff ne l'affiche pas.
  operateur_saisie: ["/dashboard/saisie"],
  commissaire: [
    "/dashboard/commissaire",
    "/dashboard/litiges",
    "/dashboard/dossiers-adu",
    "/dashboard/carte",
    "/dashboard/documents",
    "/dashboard/messages",
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
    next.litigesActifs = litiges ?? 0;
    return next;
  }

  // Propriétaire terrien (chef de famille) : « à valider » = APFC en attente de sa
  // signature + PV à régulariser ; litiges actifs sur ses parcelles. RLS déjà
  // scopée à sa famille (cf. 20260716160000_proprietaire_terrien_scope_rls.sql),
  // aucun filtre manuel nécessaire côté client.
  if (groupe === "proprietaire_terrien") {
    const [{ count: apfcs }, { count: pvs }, { count: litiges }] = await Promise.all([
      supabase.from("attestations_coutumieres").select("id", { count: "exact", head: true }).is("sig_chef_famille_le", null),
      supabase.from("pv_reunions_famille").select("id", { count: "exact", head: true }).eq("statut", "a_fournir"),
      supabase.from("litiges").select("id", { count: "exact", head: true }).neq("statut", "clos"),
    ]);
    next.ptAValider = (apfcs ?? 0) + (pvs ?? 0);
    next.litigesActifs = litiges ?? 0;
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
