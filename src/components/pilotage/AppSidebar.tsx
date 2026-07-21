"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronDown, PanelLeftClose, PanelLeftOpen, Search, Star } from "lucide-react";

import { cn } from "@/lib/utils";
import { spring } from "@/lib/motion";
import {
  SECTION_ICONS,
  SECTION_LABELS,
  SECTION_LABELS_ROLE,
  SECTION_ORDER,
  type BadgeKey,
  type NavItem,
} from "@/lib/navigation";
import { useNavFavoris } from "@/hooks/useNavFavoris";
import { Button } from "@/components/ds/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ds/tooltip";

/** Comparaison indifférente aux accents et à la casse : « geometre » doit trouver « Géomètres-experts ». */
const pliable = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * Au-delà de ce nombre d'entrées, une liste ne se parcourt plus du regard et le
 * filtre devient utile. En deçà (dashboards par rôle, 6 à 8 liens), il n'ajoute
 * que du bruit — le handoff ne le montre d'ailleurs que sur le Pilotage.
 */
const SEUIL_FILTRE = 12;

/**
 * Barre latérale du Centre de pilotage.
 *
 * Deux différences de fond avec la barre historique :
 *   — les 20+ entrées sont regroupées en sections, parce qu'une liste plate de
 *     vingt liens n'a pas de hiérarchie et se parcourt linéairement ;
 *   — elle se replie en rail d'icônes, pour rendre l'espace à la carte, qui est
 *     le composant qui mérite les pixels.
 *
 * Les règles d'accès et les pastilles viennent de `@/lib/navigation` : elles
 * sont identiques à celles de la barre historique.
 */
export function AppSidebar({
  items,
  counts,
  collapsed,
  grouped = true,
  pilotage = false,
  sousTitre = "Espace de travail",
  activeParams = null,
  onToggleCollapsed,
  onNavigate,
}: {
  items: NavItem[];
  counts: Partial<Record<BadgeKey, number>>;
  collapsed: boolean;
  /** false = liste plate dans l'ordre donné (rôles avec un ordre personnalisé,
   *  cf. `hasCustomNavOrder`) — le regroupement par section le shufflerait. */
  grouped?: boolean;
  /** true = vocabulaire national (« Cadastre », « Dossiers ») ; false = vocabulaire
   *  métier (« Registre foncier », « Instruction »). Cf. SECTION_LABELS_ROLE. */
  pilotage?: boolean;
  /** Intitulé sous « SGNF » — le handoff en donne un par écran. */
  sousTitre?: string;
  /** Paramètres d'URL courants — sert à surligner la bonne sous-entrée d'une
   *  rubrique éclatée en onglets (cf. `NavItem.deepLink`). Fourni par le pont
   *  `useSearchParams` d'AppShell (sous Suspense) ; `null` au prérendu statique. */
  activeParams?: Pick<URLSearchParams, "get"> | null;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { favoris, basculer, estFavori } = useNavFavoris();
  const [filtre, setFiltre] = React.useState("");
  /** Sections que l'utilisateur a repliées à la main — tout est ouvert par défaut. */
  const [repliees, setRepliees] = React.useState<Record<string, boolean>>({});

  const filtrable = !collapsed && items.length > SEUIL_FILTRE;
  const requete = pliable(filtre.trim());
  const filtreActif = filtrable && requete.length > 0;

  const retenus = React.useMemo(
    () => (filtreActif ? items.filter((i) => pliable(i.label).includes(requete)) : items),
    [items, filtreActif, requete],
  );

  const libelleSection = (section: NavItem["section"]) =>
    (pilotage ? undefined : SECTION_LABELS_ROLE[section]) ?? SECTION_LABELS[section];

  /** Rubrique effective : le point de vue métier peut ranger l'écran ailleurs. */
  const sectionDe = (item: NavItem) => (pilotage ? item.section : item.sectionRole ?? item.section);

  // Ordre d'épinglage, pas ordre du menu : l'utilisateur reconnaît sa liste.
  // Un favori pointant vers une entrée que son rôle ne voit plus est ignoré.
  const itemsFavoris = React.useMemo(
    () => favoris.map((href) => items.find((i) => i.href === href)).filter((i): i is NavItem => Boolean(i)),
    [favoris, items],
  );

  // `trailingSlash: true` fait que usePathname() renvoie « /dashboard/geometre/ ».
  // On normalise avant de comparer, sinon l'égalité stricte échoue toujours.
  const normalized = pathname.replace(/\/+$/, "");

  // L'épinglage n'a de sens que sur une navigation longue et dépliée : sur un
  // menu de six liens, il n'y a rien à raccourcir.
  const avecFavoris = !collapsed && grouped && items.length > SEUIL_FILTRE;

  const renderItem = (item: NavItem, enFavori = false) => {
    // Libellé selon le point de vue : « Vue nationale » pour l'admin,
    // « Centre de pilotage » pour un rôle (cf. NavItem.labelRole).
    const libelle = pilotage ? item.label : item.labelRole ?? item.label;
    // Chemin nu de l'entrée (sans le `?param=` d'une sous-entrée deep-link).
    const base = item.href.split("?")[0];
    let active: boolean;
    if (item.deepLink) {
      // Sous-entrée d'onglet : même page, on distingue par le paramètre d'URL.
      // L'entrée « par défaut » gagne quand le paramètre est absent, sinon c'est
      // la valeur exacte qui tranche — jamais deux sœurs surlignées à la fois.
      const cur = activeParams?.get(item.deepLink.key) ?? null;
      active =
        normalized === base &&
        ((item.deepLink.value != null && cur === item.deepLink.value) ||
          (!!item.deepLink.default && cur == null));
    } else {
      // La racine « /dashboard » est préfixe de tous les sous-écrans : sans
      // l'exclure du match par préfixe, elle resterait surlignée partout.
      active =
        normalized === item.href || (item.href !== "/dashboard" && normalized.startsWith(item.href + "/"));
    }
    const badge = item.badgeKey ? counts[item.badgeKey] ?? 0 : 0;
    // Dans la rubrique Favoris, l'étoile ambre remplace l'icône métier (handoff).
    const Icon = enFavori ? Star : item.icon;
    const favori = estFavori(item.href);

    const link = (
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group relative flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-[13px] outline-none transition-colors",
          "focus-visible:ring-2 focus-visible:ring-ring/50",
          active
            ? "bg-accent-subtle font-semibold text-primary"
            : "font-medium text-muted-foreground hover:bg-inset hover:text-foreground",
          // Un favori est un choix de l'utilisateur : le handoff le pose en
          // couleur de texte pleine, un cran au-dessus des liens de rubrique.
          enFavori && !active && "py-[7px] text-foreground",
          collapsed && "justify-center px-0",
          // Gouttière réservée à l'étoile : elle ne recouvre jamais la pastille.
          avecFavoris && "pr-8",
        )}
      >
        {/* Repère d'onglet actif — un trait primary, pas un fond criard. */}
        {active && (
          <motion.span
            layoutId="nav-active"
            transition={spring}
            className="absolute inset-y-[7px] left-0 w-[3px] rounded-full bg-primary"
            aria-hidden
          />
        )}
        <span className="relative shrink-0">
          <Icon className={cn("size-[17px]", enFavori && "fill-amber-500 text-amber-500")} aria-hidden />
          {badge > 0 && collapsed && (
            <span className="absolute -top-1 -right-1 size-2 rounded-full bg-danger ring-2 ring-card" aria-hidden />
          )}
        </span>
        {!collapsed && (
          <>
            <span className="truncate">{libelle}</span>
            {badge > 0 && (
              <span className="ml-auto inline-flex h-[18px] min-w-[19px] items-center justify-center rounded-[9px] bg-danger px-[5px] text-[10.5px] font-bold leading-none text-white tabular">
                {badge}
              </span>
            )}
          </>
        )}
      </Link>
    );

    return (
      <li key={`${enFavori ? "fav-" : ""}${item.href}`} className="group/item relative">
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="right">
              {libelle}
              {badge > 0 && ` · ${badge} à traiter`}
            </TooltipContent>
          </Tooltip>
        ) : (
          link
        )}

        {avecFavoris && (
          <button
            type="button"
            onClick={() => basculer(item.href)}
            aria-pressed={favori}
            aria-label={favori ? `Retirer « ${libelle} » des favoris` : `Épingler « ${libelle} » aux favoris`}
            className={cn(
              "absolute top-1/2 right-1.5 -translate-y-1/2 rounded-md p-1 outline-none transition focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50",
              // Dans la rubrique Favoris, l'étoile ambre est déjà l'icône de la
              // ligne : garder le bouton en ambre le doublerait. Il s'y fait
              // discret et ne se montre qu'au survol, pour désépingler.
              favori && !enFavori
                ? "text-amber-500 opacity-100"
                : "text-muted-2 opacity-0 group-hover/item:opacity-100 hover:text-amber-500",
            )}
          >
            <Star className={cn("size-3.5", favori && "fill-current")} aria-hidden />
          </button>
        )}
      </li>
    );
  };

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Marque — hauteur alignée sur l'en-tête (72 px) pour que les bordures
          basses des deux se rejoignent. */}
      <div className={cn("flex h-[72px] shrink-0 items-center border-b border-border", collapsed ? "justify-center px-2" : "gap-[11px] px-[18px]")}>
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-[11px] rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label="Accueil SGNF"
        >
          <span className="flex size-[38px] shrink-0 items-center justify-center rounded-[11px] bg-primary p-[3px] shadow-[0_4px_10px_rgba(11,77,136,.28)]">
            <span className="flex size-full items-center justify-center overflow-hidden rounded-[8px] bg-white">
              <Image src="/logo-embleme.png" alt="" width={28} height={28} className="object-contain" priority />
            </span>
          </span>
          {!collapsed && (
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="font-display text-[16px] font-extrabold tracking-tight text-foreground uppercase">SGNF</span>
              <span className="mt-0.5 truncate text-[10.5px] font-medium text-muted-foreground">{sousTitre}</span>
            </span>
          )}
        </Link>

      </div>

      {/* Filtre du menu — réservé aux navigations longues (cf. SEUIL_FILTRE). */}
      {filtrable && (
        <div className="px-3.5 pt-3.5 pb-2">
          <div className="flex h-[38px] items-center gap-2 rounded-[10px] border border-border bg-inset px-[11px] focus-within:border-primary/50">
            <Search className="size-[15px] shrink-0 text-muted-2" aria-hidden />
            <input
              value={filtre}
              onChange={(e) => setFiltre(e.target.value)}
              placeholder="Filtrer le menu…"
              aria-label="Filtrer le menu"
              className="w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-2"
            />
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-x-hidden overflow-y-auto px-3 pt-1.5 pb-3.5" aria-label="Navigation principale">
        {grouped ? (
          <>
            {/* Favoris — épinglés par l'utilisateur. Rubrique absente tant que
                rien n'est épinglé : un intitulé vide n'apprend rien. */}
            {avecFavoris && itemsFavoris.length > 0 && !filtreActif && (
              <div className="mb-4">
                <p className="mt-2 mb-1.5 px-2 text-[10px] font-bold tracking-[.09em] text-muted-2 uppercase">
                  Favoris
                </p>
                <ul className="flex flex-col gap-0.5">{itemsFavoris.map((item) => renderItem(item, true))}</ul>
              </div>
            )}

            {SECTION_ORDER.map((section) => {
              const sectionItems = retenus.filter((i) => sectionDe(i) === section);
              // Côté métier, l'ordre du handoff diffère de l'ordre national.
              // Les entrées sans rang gardent leur position d'origine, à la suite.
              if (!pilotage) {
                sectionItems.sort((a, b) => (a.ordreRole ?? Infinity) - (b.ordreRole ?? Infinity));
              }
              // Une section vidée par le filtre disparaît — un intitulé seul,
              // sans lien dessous, ne renseigne sur rien.
              if (sectionItems.length === 0) return null;

              if (collapsed) {
                const IconeRail = SECTION_ICONS[section];
                return (
                  <div key={section} className="mb-3.5 last:mb-0">
                    {/* En rail, le handoff garde l'icône de rubrique en tête de
                        groupe — elle situe là où un filet nu ne nomme rien.
                        On lui adjoint tout de même le filet : la maquette
                        n'exposait qu'une dizaine d'icônes, le registre réel en
                        aligne vingt-cinq, où l'icône seule ne se distingue plus
                        de celles des liens. */}
                    <div className="mx-2.5 h-px bg-border" aria-hidden />
                    <p className="flex items-center justify-center pt-2 pb-1 text-muted-2">
                      <IconeRail className="size-4 opacity-[.85]" aria-hidden />
                      <span className="sr-only">{libelleSection(section)}</span>
                    </p>
                    <ul className="flex flex-col gap-0.5">{sectionItems.map((item) => renderItem(item))}</ul>
                  </div>
                );
              }

              // Pendant une recherche les sections s'ouvrent d'office : sinon le
              // filtre remonterait des liens enfermés dans un pli.
              const ouverte = filtreActif || !repliees[section];

              const IconeSection = SECTION_ICONS[section];

              return (
                <div key={section} className="mb-1 last:mb-0">
                  {/* L'intitulé de rubrique est un repère, pas une destination :
                      il se tient en retrait (10,5 px, gris atténué, icône à
                      85 %) pour que les liens restent l'élément le plus lourd
                      de la colonne. */}
                  <button
                    type="button"
                    onClick={() => setRepliees((r) => ({ ...r, [section]: !r[section] }))}
                    aria-expanded={ouverte}
                    className="flex w-full items-center gap-[9px] rounded-lg px-2 py-1.5 text-left text-muted-foreground outline-none transition-colors hover:bg-inset hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <IconeSection className="size-4 shrink-0 opacity-[.85]" aria-hidden />
                    <span className="flex-1 truncate text-[10.5px] font-bold tracking-[.08em] uppercase">
                      {libelleSection(section)}
                    </span>
                    <ChevronDown
                      className={cn(
                        "size-[15px] shrink-0 opacity-60 transition-transform",
                        !ouverte && "-rotate-90",
                      )}
                      aria-hidden
                    />
                  </button>
                  {ouverte && (
                    <ul className="flex flex-col gap-0.5 pt-[3px] pb-2">
                      {sectionItems.map((item) => renderItem(item))}
                    </ul>
                  )}
                </div>
              );
            })}

            {filtreActif && retenus.length === 0 && (
              <p className="px-2 py-6 text-center text-[12.5px] text-muted-2">Aucune entrée de menu</p>
            )}
          </>
        ) : (
          <ul className="flex flex-col gap-0.5">{retenus.map((item) => renderItem(item))}</ul>
        )}

        {/* Un menu réduit à une seule entrée ressemble à une navigation cassée.
            Le handoff (écran Saisie) l'explique au lieu de laisser deviner. */}
        {!collapsed && retenus.length === 1 && (
          <p className="mt-3 rounded-[9px] bg-inset px-2.5 py-2.5 text-[11.5px] leading-relaxed text-muted-2">
            Votre accès est cantonné à ce module. Contactez l&apos;administration pour toute autre
            demande.
          </p>
        )}
      </nav>

      {/* Repli — bouton nommé en pied, comme le handoff, plutôt qu'une icône
          muette perdue dans l'en-tête. */}
      {onToggleCollapsed && (
        <div className="hidden shrink-0 border-t border-border px-3.5 py-3 lg:block">
          <Button
            variant="ghost"
            onClick={onToggleCollapsed}
            className={cn(
              "h-auto w-full gap-2.5 rounded-[9px] px-2.5 py-2.5 text-[13px] font-medium text-muted-foreground hover:bg-inset hover:text-foreground",
              collapsed ? "justify-center px-0" : "justify-start",
            )}
            aria-label={collapsed ? "Déplier la navigation" : "Replier la navigation"}
          >
            {collapsed ? <PanelLeftOpen className="size-[17px]" /> : <PanelLeftClose className="size-[17px]" />}
            {!collapsed && "Réduire le menu"}
          </Button>
        </div>
      )}
    </div>
  );
}
