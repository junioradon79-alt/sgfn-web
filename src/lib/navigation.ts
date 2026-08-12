import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  Bell,
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
  IdCard,
  KeyRound,
  Landmark,
  Library,
  LayoutDashboard,
  LayoutGrid,
  Link2,
  MailOpen,
  Map,
  MapPinned,
  Megaphone,
  MessageSquare,
  QrCode,
  Receipt,
  Ruler,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  TrendingUp,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import type { SupabaseClient } from "@supabase/supabase-js";
import { actionAgenceRequise, type AgenceDemande } from "./agence-actions";
import {
  apfcAttendSignature,
  type ApfcSignable,
  type ColonneSignatureApfc,
} from "./signatures-attestation";
import { fetchAllPages, type ReponsePostgrest } from "./supabase-pagination";

/**
 * Source unique de la navigation SGNF.
 *
 * Extrait à l'origine de `components/ui/Sidebar.tsx` pour que la barre latérale
 * et la palette ⌘K partagent exactement les mêmes règles d'accès. Une
 * permission ne doit exister qu'à un seul endroit. Cette ancienne barre a été
 * supprimée le 22/07 avec la migration de `/lotissements` — `AppSidebar` et la
 * palette sont désormais les deux seuls consommateurs de ce fichier.
 */

export type BadgeKey =
  | "demandes"
  | "saisie"
  | "marketplace"
  | "chefferieValidations"
  | "litigesActifs"
  | "ptAValider"
  | "messagesNonLus"
  | "dossiersAdu"
  | "missionsGeometre"
  | "acquereurAction"
  | "alertesAdmin";

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
   * Libellé dans un dashboard de rôle, quand il diffère du libellé national.
   * Même logique que `sectionRole` : « /dashboard » est la « Vue nationale » de
   * l'administrateur, mais reste le « Centre de pilotage » d'un géomètre qui n'a
   * pas de vue nationale. Absent = `label` pour tout le monde.
   */
  labelRole?: string;
  /**
   * Sous-entrée pointant vers un onglet/section d'une page déjà existante, via
   * un paramètre d'URL (le handoff éclate certaines rubriques — Administration,
   * Paiements… — en plusieurs liens alors que c'est une seule page à onglets).
   * `key` = nom du paramètre ; `value` = valeur qui active cette entrée ;
   * `default` = entrée active quand le paramètre est absent. La page lit ce même
   * paramètre pour ouvrir le bon onglet ; la barre s'y surligne en miroir.
   */
  deepLink?: { key: string; value?: string; default?: boolean };
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
  comptable: "Comptabilité & RH",
  collaborateur: "Espace Collaborateur",
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
  // Le handoff éclate le Centre de pilotage en trois liens : Vue nationale (la
  // carte + les KPI), Centre d'alertes et Activité temps réel — trois sections
  // d'une même page, atteintes par `?focus=`. Le géomètre, lui, ne voit que la
  // première (via sa liste fermée ROLE_NAV_ORDER) : « Vue nationale » n'a pas de
  // sens pour lui, d'où `labelRole`. `roles: []` = admin.
  { label: "Vue nationale", labelRole: "Centre de pilotage", href: "/dashboard", icon: LayoutDashboard, section: "pilotage", roles: [], deepLink: { key: "focus", default: true }, keywords: "accueil tableau de bord home vue nationale carte" },
  { label: "Centre d'alertes", href: "/dashboard?focus=alertes", icon: Bell, section: "pilotage", roles: [], deepLink: { key: "focus", value: "alertes" }, badgeKey: "alertesAdmin", keywords: "alertes signaux urgences à traiter ce qui brûle" },
  { label: "Activité temps réel", href: "/dashboard?focus=activite", icon: Activity, section: "pilotage", roles: [], deepLink: { key: "focus", value: "activite" }, keywords: "activité récente journal flux temps réel" },
  { label: "Supervision", href: "/dashboard/commissaire", icon: ShieldCheck, section: "pilotage", roles: ["commissaire", "verificateur"] },
  // Le handoff range la carte sous Cadastre et l'IA sous Intelligence.
  { label: "Carte foncière", href: "/dashboard/carte", icon: MapPinned, section: "cadastre", roles: ["geometre", "commissaire", "verificateur"], keywords: "gps parcelles géolocalisation" },
  { label: "SGNF AI", href: "/dashboard/ia", icon: Sparkles, section: "intelligence", roles: ["verificateur", "agent_ia", "geometre"] },

  // ── Cadastre (« Registre foncier » côté métier) ──
  { label: "Lotissements", href: "/lotissements", icon: Map, section: "cadastre", roles: ["operateur", "amenageur", "geometre", "chefferie", "verificateur", "proprietaire_terrien"], ordreRole: 1 },
  { label: "Îlots", href: "/dashboard/ilots", icon: LayoutGrid, section: "cadastre", roles: [], keywords: "blocs découpage périmètre" },
  { label: "Lots & parcelles", href: "/dashboard/lots", icon: Boxes, section: "cadastre", roles: ["operateur", "amenageur", "geometre", "verificateur", "commissaire", "proprietaire_terrien"], keywords: "parcelles terrains lots", ordreRole: 2 },
  { label: "Géomètres-experts", href: "/dashboard/geometres", icon: Ruler, section: "cadastre", roles: [], keywords: "bornage numéro d'ordre cabinet" },

  // ── Dossiers (« Instruction » côté métier) ──
  { label: "Dossiers ADU / ACD", href: "/dashboard/dossiers-adu", icon: ClipboardList, section: "dossiers", roles: ["geometre", "commissaire", "verificateur", "chefferie", "proprietaire_terrien"], badgeKey: "dossiersAdu", keywords: "acd adu instruction urbanisme dossiers" },
  { label: "Litiges", href: "/dashboard/litiges", icon: FileWarning, section: "dossiers", roles: ["commissaire", "verificateur", "chefferie", "proprietaire_terrien"], badgeKey: "litigesActifs", keywords: "conflits contentieux" },
  { label: "Demandes d'acquisition", href: "/dashboard/demandes-acquisition", icon: ClipboardCheck, section: "dossiers", roles: ["operateur"], badgeKey: "demandes", keywords: "ventes tunnel acquéreur", ordreRole: 1 },
  { label: "Attributions", href: "/dashboard/attributions", icon: Link2, section: "dossiers", sectionRole: "cadastre", roles: ["operateur", "amenageur", "verificateur", "commissaire", "proprietaire_terrien"], ordreRole: 4 },
  { label: "Concertation", href: "/dashboard/concertation", icon: Handshake, section: "dossiers", roles: ["chefferie", "proprietaire", "operateur", "proprietaire_terrien"], ordreRole: 3 },
  { label: "Validations", href: "/dashboard/validations", icon: ClipboardCheck, section: "dossiers", roles: [], keywords: "approbation contrôle" },
  { label: "Démarches", href: "/dashboard/demarches", icon: Ruler, section: "dossiers", roles: ["geometre"], keywords: "bornage honoraires transmission mutation" },

  // ── Marketplace ──
  { label: "Annonces publiées", href: "/dashboard/annonces", icon: Megaphone, section: "marketplace", roles: ["admin"], keywords: "marketplace terraci market annonces publiées ventes en ligne mon terrain" },
  { label: "Contacts TerraCI Market", href: "/dashboard/contacts-marketplace", icon: Store, section: "marketplace", roles: ["admin"], badgeKey: "marketplace", keywords: "marketplace annonces mon terrain contacts acheteurs" },

  // ── Utilisateurs ──
  { label: "Attributaires", href: "/dashboard/attributaires", icon: Users, section: "utilisateurs", sectionRole: "cadastre", roles: ["operateur", "amenageur", "verificateur", "commissaire", "proprietaire_terrien"], keywords: "bénéficiaires", ordreRole: 3 },
  { label: "Familles & chefferies", href: "/dashboard/familles", icon: Home, section: "utilisateurs", roles: [], keywords: "familles chefferies lignages autorités" },
  { label: "Invitations", href: "/dashboard/invitations", icon: MailOpen, section: "utilisateurs", sectionRole: "dossiers", roles: ["operateur", "amenageur", "proprietaire_terrien"], ordreRole: 2 },

  // ── Paiements ──
  // Une seule page (`/dashboard/paiements`) à deux vues, éclatée en deux liens
  // par le handoff : le registre (Transactions) et la file de validation
  // manuelle (Réconciliation), atteinte par `?vue=reconciliation`.
  { label: "Transactions", href: "/dashboard/paiements", icon: Receipt, section: "paiements", roles: [], deepLink: { key: "vue", default: true }, keywords: "transactions encaissements recettes quittances registre paiements" },
  { label: "Réconciliation", href: "/dashboard/paiements?vue=reconciliation", icon: ArrowLeftRight, section: "paiements", roles: [], deepLink: { key: "vue", value: "reconciliation" }, keywords: "réconciliation validation manuelle paiements à valider rapprochement" },

  // ── Statistiques ──
  // Page unique à deux sections (handoff) : les séries mensuelles (Rapports) et
  // les classements territoriaux (Performance régionale), atteinte par `?focus=`.
  { label: "Rapports", href: "/dashboard/statistiques", icon: BarChart3, section: "statistiques", roles: [], deepLink: { key: "focus", default: true }, keywords: "rapports statistiques séries mensuelles cadastre actes analyse" },
  { label: "Performance régionale", href: "/dashboard/statistiques?focus=performance", icon: TrendingUp, section: "statistiques", roles: [], deepLink: { key: "focus", value: "performance" }, keywords: "performance régionale classement districts territoires occupation" },

  // ── Intelligence ──
  // `chefferie` ajouté le 30/07 : la page l'éjectait alors que `soumettre_saisie`
  // l'accepte depuis le 16/07 (fiche de lotissement) et, désormais, sur la fiche
  // d'un lot, le numéro d'un îlot et la correction d'un attributaire de sa
  // juridiction. Une page ouverte sans entrée de menu reste inatteignable.
  { label: "Saisie assistée", href: "/dashboard/saisie", icon: ClipboardEdit, section: "intelligence", roles: ["operateur_saisie", "chefferie"], badgeKey: "saisie", keywords: "import excel validation saisie assistée foncière lot îlot attributaire" },

  // ── Administration ──
  // Le handoff éclate l'écran Administration en ses quatre onglets. Une seule
  // page (`/dashboard/administration`), quatre liens vers ses volets via
  // `?volet=` ; « Utilisateurs système » (onglet comptes) est l'onglet par défaut.
  { label: "Utilisateurs système", href: "/dashboard/administration", icon: Users, section: "administration", roles: [], deepLink: { key: "volet", default: true }, keywords: "utilisateurs système comptes administration accès" },
  { label: "Rôles & permissions", href: "/dashboard/administration?volet=roles", icon: KeyRound, section: "administration", roles: [], deepLink: { key: "volet", value: "roles" }, keywords: "rôles permissions droits accès habilitations" },
  { label: "Journal d'audit", href: "/dashboard/administration?volet=audit", icon: ScrollText, section: "administration", roles: [], deepLink: { key: "volet", value: "audit" }, keywords: "journal audit traçabilité historique événements" },
  { label: "Référentiels", href: "/dashboard/administration?volet=referentiels", icon: Library, section: "administration", roles: [], deepLink: { key: "volet", value: "referentiels" }, keywords: "référentiels opérateurs commissaires justice registre entités" },
  { label: "Paramètres", href: "/dashboard/administration?volet=parametres", icon: Settings, section: "administration", roles: [], deepLink: { key: "volet", value: "parametres" }, keywords: "paramètres réglages configuration tarifs" },
  // Comptabilité + RH : back-office interne SGNF (24/07). `roles: ["comptable"]`
  // affiche ces deux entrées à l'admin (qui contourne le filtre `roles`, cf.
  // `visibleNavItems`) ET au nouveau rôle comptable — mais à personne d'autre.
  { label: "Comptabilité", href: "/dashboard/comptabilite", icon: Wallet, section: "administration", roles: ["comptable"], keywords: "comptabilité recettes dépenses solde finances trésorerie" },
  { label: "Collaborateurs", href: "/dashboard/collaborateurs", icon: UsersRound, section: "administration", roles: ["comptable"], keywords: "rh ressources humaines personnel équipe employés annuaire" },

  // ── Espaces dédiés (masqués pour l'admin) ──
  { label: "Mon espace", href: "/dashboard/mon-achat", icon: ClipboardCheck, section: "espaces", roles: ["acquereur"], adminHide: true, badgeKey: "acquereurAction", keywords: "acquéreur suivi terrains achat" },
  { label: "Trouver un terrain", href: "/dashboard/acquisition", icon: Compass, section: "espaces", roles: ["acquereur", "amenageur", "operateur"], adminHide: true },
  { label: "Mon espace", href: "/dashboard/proprietaire", icon: Landmark, section: "espaces", roles: ["proprietaire", "acquereur"], adminHide: true },
  { label: "Mettre en vente", href: "/dashboard/mettre-en-vente", icon: Store, section: "espaces", roles: ["proprietaire", "proprietaire_terrien"], adminHide: true, keywords: "marketplace annonce terraci market vendre terrain" },
  { label: "Mon activité", href: "/dashboard/operateur", icon: HandCoins, section: "espaces", roles: ["operateur"], adminHide: true },
  { label: "Espace Chefferie", href: "/dashboard/chefferie", icon: Crown, section: "espaces", roles: ["chefferie"], adminHide: true, badgeKey: "chefferieValidations" },
  { label: "Propriétaire terrien", href: "/dashboard/proprietaire-terrien", icon: Home, section: "espaces", roles: ["proprietaire_terrien"], adminHide: true, badgeKey: "ptAValider" },
  { label: "Espace Géomètre", href: "/dashboard/geometre", icon: Ruler, section: "espaces", roles: ["geometre"], adminHide: true },
  { label: "Mes missions", href: "/dashboard/missions", icon: Briefcase, section: "espaces", roles: ["geometre"], adminHide: true, badgeKey: "missionsGeometre" },
  // Collaborateur : rôle minimal (24/07), sa seule donnée propre est sa fiche
  // RH (lecture seule, policy `collaborateurs_lecture_soi`).
  { label: "Ma fiche RH", href: "/dashboard/mon-profil-rh", icon: IdCard, section: "espaces", roles: ["collaborateur"], adminHide: true },

  // ── Documents ──
  // « Registre documentaire » côté national (handoff) ; « Documents », plus
  // sobre, pour un acquéreur ou un géomètre qui y range ses propres pièces.
  { label: "Registre documentaire", labelRole: "Documents", href: "/dashboard/documents", icon: FileText, section: "documents", sectionRole: "general", keywords: "registre documentaire documents actes attestations pv" },
  { label: "Consultations QR", href: "/dashboard/consultations-qr", icon: QrCode, section: "documents", roles: ["admin"], keywords: "vérification qr code" },

  // ── Général ──
  { label: "Messages", href: "/dashboard/messages", icon: MessageSquare, section: "general", badgeKey: "messagesNonLus", keywords: "messagerie conversations non lus" },
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
    // Placée haut : c'est le geste quotidien ouvert le 30/07 (corriger une
    // fiche du parc), et une liste ordonnée qui l'enterrerait en bas dirait le
    // contraire de ce que le chantier vient d'ouvrir.
    "/dashboard/saisie",
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
  // Comptable : back-office interne, liste fermée aux deux modules + messagerie.
  comptable: ["/dashboard/comptabilite", "/dashboard/collaborateurs", "/dashboard/messages"],
  // Collaborateur : rôle minimal (24/07), liste fermée à sa fiche + messagerie.
  collaborateur: ["/dashboard/mon-profil-rh", "/dashboard/messages"],
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

/**
 * Espace d'atterrissage de chaque rôle. Vit ici, à côté de `ROLE_NAV_ORDER`,
 * parce que deux consommateurs en dépendent et doivent dire la même chose : la
 * page d'aiguillage `/dashboard` et la garde de route ci-dessous. Les groupes
 * absents (admin, agent_ia…) restent sur le Centre de pilotage national.
 */
export const ROLE_HOME: Record<string, string> = {
  // « Propriétaire » (par achat) déprécié → fondu dans proprietaire_terrien ;
  // filet de sécurité si un compte legacy subsiste.
  proprietaire: "/dashboard/proprietaire-terrien",
  acquereur: "/dashboard/mon-achat",
  // « Aménageur » fusionné dans « opérateur » : filet de sécurité si un compte
  // legacy `amenageur` subsiste — il atterrit sur l'espace opérateur.
  amenageur: "/dashboard/operateur",
  operateur: "/dashboard/operateur",
  commissaire: "/dashboard/commissaire",
  verificateur: "/dashboard/commissaire",
  chefferie: "/dashboard/chefferie",
  proprietaire_terrien: "/dashboard/proprietaire-terrien",
  operateur_saisie: "/dashboard/saisie",
  geometre: "/dashboard/geometre",
  // Comptable : oubliée à sa création (24/07) — atterrissait sur ce Centre de
  // pilotage national, hors de portée RLS pour ce rôle. Collaborateur : nouveau
  // rôle minimal (24/07), sa fiche RH est son seul espace.
  comptable: "/dashboard/comptabilite",
  collaborateur: "/dashboard/mon-profil-rh",
};

/** Espace du rôle ; le Centre de pilotage pour les groupes sans entrée. */
export function accueilDuRole(groupe: string | null): string {
  return (groupe && ROLE_HOME[groupe]) || "/dashboard";
}

/**
 * Routes ouvertes à TOUT rôle, y compris ceux dont le menu est une liste fermée.
 * Elles n'apparaissent dans aucune barre latérale : impossible de les déduire de
 * `NAV_ITEMS`, et les fermer priverait les rôles resserrés de gestes que
 * l'application leur offre par ailleurs.
 *
 * - `/dashboard/profil` — proposé par le menu utilisateur de l'en-tête
 *   (`AppHeader`) et par la palette de commandes, pour tous les rôles.
 * - `/dashboard/messages` — l'icône de messagerie de l'en-tête y pousse quel que
 *   soit le rôle, même quand la barre latérale ne l'affiche pas (chefferie,
 *   propriétaire terrien, opérateur de saisie).
 * - `/dashboard/paiements/retour` — page de retour de CinetPay (`return_url` de
 *   l'edge function `initier-paiement`) : la fermer casserait la confirmation de
 *   paiement pour tout rôle qui paie.
 */
const ROUTES_TOUJOURS_OUVERTES = [
  "/dashboard/profil",
  "/dashboard/messages",
  "/dashboard/paiements/retour",
];

/**
 * Routes qu'un rôle peut OUVRIR sans qu'elles apparaissent dans son menu.
 *
 * 🔴 Le commit `385e414` a dérivé les routes atteignables du MENU seul. Or un
 * écran pousse aussi vers des sous-écrans qu'aucune barre latérale n'annonce :
 * `/dashboard/chefferie` renvoie CINQ fois vers `/dashboard/validations` — dont
 * ses boutons « Signer » (APFC) et « Examiner » (cessions à valider) — et la
 * garde les refusait toutes. Le chef de village, qui signe réellement (la
 * policy `attcess_chefferie_read` lui rend 106 attestations sur 106, et
 * `attestations_cession` porte `sig_chefferie_le`), était renvoyé à son accueil
 * à chaque clic.
 *
 * Pourquoi une table séparée plutôt qu'une ligne de plus dans `ROLE_NAV_ORDER` :
 * cette dernière a DEUX consommateurs. `visibleNavItems` en tire les entrées de
 * la barre latérale, `routeAutorisee` les routes ouvertes. Y ajouter un href
 * ouvrirait la route ET ferait apparaître l'entrée — ce qu'on ne veut pas ici :
 *
 *  - `/dashboard/validations` est un SOUS-ÉCRAN de l'Espace Chefferie, sorti de
 *    lui quand il est passé aux cartes ; il porte son propre bouton « Retour à
 *    l'Espace Chefferie ». Son entrée `NAV_ITEMS` est d'ailleurs déclarée
 *    `roles: []` (administration) : l'inscrire dans la liste chefferie ferait
 *    dire deux choses contraires au même fichier.
 *  - `/dashboard/mettre-en-vente` n'est offert qu'aux comptes `chefferie`
 *    rattachés à une FAMILLE, que `/dashboard/chefferie` rend via
 *    `ProprietaireTerrienView` (les deux modèles cohabitent, cf. l'en-tête de
 *    cette vue). L'afficher dans le menu le proposerait aussi aux chefs de
 *    village sans famille, qui n'ont aucun lot à vendre.
 */
const ROUTES_HORS_MENU: Partial<Record<string, string[]>> = {
  chefferie: ["/dashboard/validations", "/dashboard/mettre-en-vente"],
};

/** `/dashboard/lots/` et `/dashboard/lots?vue=x` → `/dashboard/lots`. */
function normaliserChemin(chemin: string): string {
  const sansQuery = chemin.split("?")[0].split("#")[0];
  return sansQuery.length > 1 ? sansQuery.replace(/\/+$/, "") : sansQuery;
}

/**
 * `base` couvre-t-il `chemin` — lui-même, ou une de ses sous-routes ? La
 * comparaison se fait sur une frontière de segment : sans elle, `/dashboard/lots`
 * ouvrirait aussi `/dashboard/lotissements`.
 */
function couvre(base: string, chemin: string): boolean {
  return chemin === base || chemin.startsWith(base + "/");
}

/**
 * Ce rôle peut-il ouvrir cette route de `/dashboard` ?
 *
 * ⚠️ **Garde d'interface, pas frontière de sécurité.** Le site est un export
 * statique : ce contrôle vit dans le navigateur et se contourne. Ce qui protège
 * les données reste la RLS, et elle tient — un collaborateur qui forçait
 * `/dashboard/lots` y lisait déjà 0 lot. Ce qui se ferme ici, c'est l'écart entre
 * ce que l'écran PROPOSE et ce que le serveur ACCEPTE : « Nouveau
 * collaborateur », « Modifier », « Supprimer » s'affichaient pour un rôle dont
 * chaque écriture aurait été refusée. Même principe que le test
 * `scripts/e2e-app-roles-metier.mjs` — ne pas offrir un formulaire que la base
 * refuse, sous peine de faire remplir une fiche entière pour rien.
 *
 * Ne borne QUE les rôles dotés d'une liste fermée (`ROLE_NAV_ORDER`). Un rôle
 * absent de cette table — admin, vérificateur, opérateur… — passe partout, tout
 * comme sa barre latérale n'est pas resserrée : la garde n'invente aucune règle,
 * elle applique celle qui décrivait déjà le menu.
 */
export function routeAutorisee(groupe: string | null, chemin: string): boolean {
  // Profil pas encore chargé : ne rien bloquer, l'appelant attend.
  if (!groupe) return true;
  const order = ROLE_NAV_ORDER[groupe];
  if (!order) return true;

  const route = normaliserChemin(chemin);
  // `/dashboard` exactement : page d'aiguillage, elle redirige elle-même vers
  // l'espace du rôle. Comparaison stricte — la traiter en préfixe ouvrirait
  // évidemment tout `/dashboard/*`.
  if (route === "/dashboard") return true;
  if (ROUTES_TOUJOURS_OUVERTES.some((base) => couvre(base, route))) return true;
  if ((ROUTES_HORS_MENU[groupe] ?? []).some((base) => couvre(base, route))) return true;
  return order.some((href) => {
    const base = normaliserChemin(href);
    // 🔴 `/dashboard` figure dans la liste du géomètre (son « Centre de
    // pilotage »). Traité en préfixe comme les autres, il couvrait TOUT
    // `/dashboard/*` : la garde était entièrement inerte pour ce rôle, qui
    // ouvrait `/dashboard/administration` comme n'importe quelle autre page.
    // Le renvoi en égalité, quelques lignes plus haut, ne protégeait que la
    // route elle-même — pas ce que la liste en dérivait.
    if (base === "/dashboard") return route === base;
    return couvre(base, route);
  });
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

/** Dossiers ADU « en cours » = ni délivré, ni ACD obtenu, ni rejeté (cf. `ADU_TERMINE`
 *  dans useAdminOverview). RLS scope le périmètre du rôle — aucun filtre client. */
async function compterDossiersAdu(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase
    .from("dossiers_adu")
    .select("id", { count: "exact", head: true })
    .not("statut", "in", "(adu_delivree,acd_obtenu,rejete)");
  return count ?? 0;
}

/** Litiges non clos, scopés RLS au périmètre du rôle. */
async function compterLitiges(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase
    .from("litiges")
    .select("id", { count: "exact", head: true })
    .neq("statut", "clos");
  return count ?? 0;
}

/**
 * APFC attendant RÉELLEMENT une signature donnée, scopées RLS au périmètre du
 * rôle (juridiction pour la chefferie, famille pour le propriétaire terrien).
 *
 * 🔴 Les deux compteurs se contentaient d'un `.is("sig_…_le", null)` en
 * `head:true`. Une colonne vide n'est pas une signature en attente : encore
 * faut-il que le lotissement l'EXIGE. L'APFC de Koelea-Accor, dont le
 * lotissement n'exige pas le CVGFR et dont les deux signatures sont désormais
 * constatées, aurait continué à gonfler la pastille du chef de famille.
 *
 * On lit les lignes au lieu de compter côté serveur : le créneau CVGFR dépend
 * de `cvgfr_id` et le reste de `signatures_requises`, un prédicat que PostgREST
 * ne sait pas exprimer en un filtre. Le prédicat est alors EXACTEMENT celui des
 * écrans (`etatSignaturesApfc`), et une pastille ne peut plus diverger de la
 * liste qu'elle annonce.
 *
 * ⚠️ La lecture est PAGINÉE. « Borné par la RLS » ne borne pas le nombre de
 * lignes : la RLS borne le périmètre, PostgREST plafonne chaque réponse à 1000
 * lignes et tronque le reste sans le dire (`supabase-pagination`). Sans effet
 * aujourd'hui (1 APFC en base au 29/07/2026) ; sans pagination, la pastille
 * serait devenue fausse en silence le jour où une juridiction en portera 1001.
 */
async function compterApfcEnAttente(
  supabase: SupabaseClient,
  colonne: ColonneSignatureApfc,
): Promise<number> {
  const lignes = await fetchAllPages<ApfcSignable>(
    (de, a) =>
      supabase
        .from("attestations_coutumieres")
        .select(
          "id, sig_chef_famille_le, sig_chef_village_le, sig_cvgfr_le, cvgfr_id, lotissement:lotissement_id(signatures_requises)",
        )
        .order("id", { ascending: true })
        .range(de, a) as unknown as PromiseLike<ReponsePostgrest<ApfcSignable>>,
  );
  // Une pastille n'a pas de place où loger un motif d'erreur : un refus s'y
  // lit forcément « 0 à faire ». On ne cherche donc pas à l'afficher ici — les
  // ÉCRANS qu'elle annonce (`/dashboard/validations`, l'Espace Chefferie) le
  // disent désormais, eux, avec le motif. Le compteur reste prudent : il ne
  // compte que ce qui a été effectivement lu.
  return lignes.rows.filter((a) => apfcAttendSignature(a, colonne)).length;
}

/**
 * Cessions que le chef de village doit RÉELLEMENT signer.
 *
 * `sig_chefferie_le is null` ne suffit pas : encore faut-il que le lotissement
 * exige la signature `chefferie`. Le filtre porte donc sur l'embed imbriqué —
 * PostgREST l'applique bien à un `count=exact` en HEAD, vérifié en production
 * le 29/07 (50 en attente ; contre-épreuve avec `cs.{operateur}`, une clé que
 * Koelea-Accor revu n'a pas : 0 — le filtre n'est donc pas ignoré).
 *
 * Compter côté serveur plutôt que lire les lignes est ici essentiel : cette
 * file dépasse 400 entrées sur une juridiction large, et un `count:'exact'`
 * n'est pas plafonné à 1000, contrairement à une lecture de lignes.
 *
 * `signatures_requises` est NOT NULL en base (défaut `{proprietaire, operateur,
 * chefferie}`) : `cs.{chefferie}` ne peut pas écarter à tort une ligne « non
 * configurée ».
 */
async function compterCessionsChefferie(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase
    .from("attestations_cession")
    .select("id, lot:lot_id!inner(ilots!inner(lotissements!inner(signatures_requises)))", {
      count: "exact",
      head: true,
    })
    .is("sig_chefferie_le", null)
    // 🔴 Une cession `revoquee` ne peut plus être signée —
    // `signer_attestation` lève une exception explicite, même garde que sur
    // `compterAttributionsLotChefferie` ci-dessous. Sans ce filtre, une
    // cession révoquée restait comptée ici (pastille rouge permanente) alors
    // que le bouton « Valider » qu'elle affiche échouerait à chaque tentative.
    .neq("statut", "revoquee")
    .contains("lot.ilots.lotissements.signatures_requises", ["chefferie"]);
  return count ?? 0;
}

/**
 * Attestations d'Attribution de Lot (N2/N3, 23/07/2026) que le chef de village
 * doit RÉELLEMENT signer : même filtre que `compterCessionsChefferie`
 * ci-dessus, sur la table sœur, plus la garde de paiement de signature —
 * `signer_attestation_attribution_lot` refuse tant que `signature_payee_le`
 * n'est pas confirmé (360 000 FCFA chefferie + 20 000 FCFA commission SGNF).
 * Cf. `attributionsSignables` dans `/dashboard/validations/page.tsx`, source de
 * vérité de ce prédicat.
 */
async function compterAttributionsLotChefferie(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase
    .from("attestations_attribution_lot")
    .select("id, lot:lot_id!inner(ilots!inner(lotissements!inner(signatures_requises)))", {
      count: "exact",
      head: true,
    })
    .not("signature_payee_le", "is", null)
    .is("sig_chefferie_le", null)
    .neq("statut", "revoquee")
    .contains("lot.ilots.lotissements.signatures_requises", ["chefferie"]);
  return count ?? 0;
}

/** Demandes d'acquisition où l'agence doit jouer (cf. `actionAgenceRequise`). */
async function compterDemandesAgence(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase
    .from("demandes_acquisition_agence")
    .select("statut,vente_id,vente_statut,vente_paiement_statut,cession_id,paiement_statut,attestation_reference");
  return ((data ?? []) as AgenceDemande[]).filter(actionAgenceRequise).length;
}

/** « Site TerraCI Market à reconstruire » : une annonce publiée depuis le dernier
 *  déploiement cPanel connu (1 = à refaire, 0 = à jour). */
async function compterMarketplaceARebuild(supabase: SupabaseClient): Promise<number> {
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
  const dr = (etat as { derniere_reconstruction: string | null } | null)?.derniere_reconstruction ?? null;
  const dp = (derniere as { publiee_le: string | null } | null)?.publiee_le ?? null;
  return dp && (!dr || dp > dr) ? 1 : 0;
}

/** Action acquéreur = un paiement EN ATTENTE (son tour de payer) rattaché à une de
 *  ses demandes (vente ou cession). On ne compte QUE `en_attente` : `confirme` est
 *  soldé, `echoue`/`rembourse` sont clos, et `en_attente_validation` est le tour de
 *  l'agence, pas de l'acquéreur (rouge = « à nous de jouer »). RLS borne
 *  demandes/paiements à l'acquéreur. */
async function compterAcquereurAction(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase.from("demandes_acquisition").select("vente_id,cession_id");
  const rows = (data ?? []) as { vente_id: string | null; cession_id: string | null }[];
  const venteIds = [...new Set(rows.map((r) => r.vente_id).filter((v): v is string => !!v))];
  const cessionIds = [...new Set(rows.map((r) => r.cession_id).filter((v): v is string => !!v))];
  let n = 0;
  if (venteIds.length) {
    const { count } = await supabase
      .from("paiements")
      .select("id", { count: "exact", head: true })
      .in("vente_id", venteIds)
      .eq("statut", "en_attente");
    n += count ?? 0;
  }
  if (cessionIds.length) {
    const { count } = await supabase
      .from("paiements")
      .select("id", { count: "exact", head: true })
      .in("cession_id", cessionIds)
      .eq("statut", "en_attente");
    n += count ?? 0;
  }
  return n;
}

/**
 * Compteurs d'actions à faire — pastilles rouges de la barre latérale ET compteur
 * de la cloche (messages non lus).
 *
 * Principe : rouge = « c'est à nous de jouer », jamais « on attend le client ».
 * Chaque compteur = une requête `head:true` scopée par la RLS du rôle. Les
 * messages non lus sont universels (tous les rôles) ; les autres files dépendent
 * des actions propres à chaque rôle.
 */
export async function fetchBadgeCounts(
  supabase: SupabaseClient,
  groupe: string | null,
): Promise<Partial<Record<BadgeKey, number>>> {
  const next: Partial<Record<BadgeKey, number>> = {};
  if (!groupe) return next;

  // ── Messages non lus — universel (cloche de l'en-tête + entrée « Messages ») ──
  // La RLS borne déjà `messages` aux conversations dont je suis participant ; on
  // exclut mes propres envois pour ne compter que le « reçu non lu ». `getSession`
  // est local (pas d'appel réseau).
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const myId = session?.user?.id ?? null;
  if (myId) {
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("lu", false)
      .neq("expediteur", myId);
    next.messagesNonLus = count ?? 0;
  }

  switch (groupe) {
    // ── Chefferie (chef de village) — RLS scopée par juridiction (ma_chefferie_id()). ──
    case "chefferie": {
      const [cessions, apfcs, attributionsLot, litiges, adu, rejetees] = await Promise.all([
        compterCessionsChefferie(supabase),
        compterApfcEnAttente(supabase, "sig_chef_village_le"),
        compterAttributionsLotChefferie(supabase),
        compterLitiges(supabase),
        compterDossiersAdu(supabase),
        // Même sémantique que pour `operateur_saisie` : la pastille de « Saisie
        // assistée » compte ce qu'il y a **à faire de son côté**, c'est-à-dire
        // ses soumissions renvoyées, et non la file nationale — qu'elle ne voit
        // pas et sur laquelle elle ne peut rien. La RLS de `soumissions_saisie`
        // borne déjà le compte à ses propres lignes.
        supabase
          .from("soumissions_saisie")
          .select("id", { count: "exact", head: true })
          .eq("statut", "rejetee"),
      ]);
      next.chefferieValidations = cessions + apfcs + attributionsLot;
      next.litigesActifs = litiges;
      next.dossiersAdu = adu;
      next.saisie = rejetees.count ?? 0;
      break;
    }

    // ── Propriétaire terrien (chef de famille) — RLS scopée à sa famille. ──
    case "proprietaire_terrien": {
      const [apfcs, { count: pvs }, litiges, adu] = await Promise.all([
        compterApfcEnAttente(supabase, "sig_chef_famille_le"),
        supabase.from("pv_reunions_famille").select("id", { count: "exact", head: true }).eq("statut", "a_fournir"),
        compterLitiges(supabase),
        compterDossiersAdu(supabase),
      ]);
      next.ptAValider = apfcs + (pvs ?? 0);
      next.litigesActifs = litiges;
      next.dossiersAdu = adu;
      break;
    }

    // ── Géomètre-expert — ses missions en cours + les dossiers ADU qui le concernent. ──
    case "geometre": {
      const [{ count: missions }, adu] = await Promise.all([
        supabase.from("missions_geometre").select("id", { count: "exact", head: true }).not("statut", "in", "(terminee,annulee)"),
        compterDossiersAdu(supabase),
      ]);
      next.missionsGeometre = missions ?? 0;
      next.dossiersAdu = adu;
      break;
    }

    // ── Commissaire / Vérificateur — supervision, RLS scopée. ──
    case "commissaire":
    case "verificateur": {
      const [litiges, adu] = await Promise.all([compterLitiges(supabase), compterDossiersAdu(supabase)]);
      next.litigesActifs = litiges;
      next.dossiersAdu = adu;
      break;
    }

    // ── Agent de saisie — « à nous de jouer » = ses soumissions rejetées, à corriger.
    //    `soumissions_saisie.statut` est un texte libre : la valeur est « rejetee ». ──
    case "operateur_saisie": {
      const { count } = await supabase.from("soumissions_saisie").select("id", { count: "exact", head: true }).eq("statut", "rejetee");
      next.saisie = count ?? 0;
      break;
    }

    // ── Acquéreur — un paiement à régler sur son achat. ──
    case "acquereur": {
      next.acquereurAction = await compterAcquereurAction(supabase);
      break;
    }

    // ── Opérateur (agence scopée) — sa file de demandes. ──
    case "operateur": {
      next.demandes = await compterDemandesAgence(supabase);
      break;
    }

    // ── Administration nationale — toutes les files ; « Centre d'alertes » = leur somme. ──
    case "admin": {
      const [demandes, { count: saisie }, litiges, adu, marketplace] = await Promise.all([
        compterDemandesAgence(supabase),
        supabase.from("soumissions_saisie").select("id", { count: "exact", head: true }).eq("statut", "en_attente"),
        compterLitiges(supabase),
        compterDossiersAdu(supabase),
        compterMarketplaceARebuild(supabase),
      ]);
      next.demandes = demandes;
      next.saisie = saisie ?? 0;
      next.litigesActifs = litiges;
      next.dossiersAdu = adu;
      next.marketplace = marketplace;
      // Centre d'alertes = somme des files foncières à traiter (hors messages).
      next.alertesAdmin = demandes + (saisie ?? 0) + litiges + adu;
      break;
    }
  }

  return next;
}
