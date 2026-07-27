"use client";

import type { LucideIcon } from "lucide-react";

// Barre d'onglets générique : chaque expérience (citoyen, admin, …) passe sa
// propre liste. Un item `fab` est rendu en bouton central surélevé (ex. Vérifier)
// et déclenche `onPress` plutôt qu'une navigation d'onglet.

export type TabItem = {
  key: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  fab?: boolean;
  onPress?: () => void;
};

export function TabBar({
  items,
  active,
  onNavigate,
}: {
  items: TabItem[];
  active: string;
  onNavigate: (key: string) => void;
}) {
  // Le FAB est posé entre deux moitiés de largeur égale, et non aligné parmi
  // les onglets : ainsi il reste centré quel que soit leur nombre. Avec quatre
  // onglets (l'admin) le rendu est identique au précédent ; avec trois (les
  // rôles métier), un simple `justify-between` le laissait à ~37 % de la
  // largeur, visiblement décalé vers la gauche.
  const iFab = items.findIndex((it) => it.fab);
  const avant = iFab >= 0 ? items.slice(0, iFab) : items;
  const apres = iFab >= 0 ? items.slice(iFab + 1) : [];
  const fab = iFab >= 0 ? items[iFab] : null;

  const onglet = (it: TabItem) => {
    const Icon = it.icon;
    return (
      <button
        key={it.key}
        type="button"
        onClick={it.onPress ?? (() => onNavigate(it.key))}
        className={`flex flex-1 flex-col items-center gap-0.5 bg-transparent ${
          active === it.key ? "text-primary" : "text-muted-2"
        }`}
      >
        <span className="relative">
          <Icon className="size-[23px]" strokeWidth={2} />
          {it.badge ? (
            // Brique : c'est une file à traiter, pas une anomalie.
            <span className="tabular absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-brick px-1 text-[10px] font-bold text-brick-foreground">
              {it.badge > 99 ? "99+" : it.badge}
            </span>
          ) : null}
        </span>
        <span className="text-[10px] font-semibold">{it.label}</span>
      </button>
    );
  };

  return (
    <nav className="flex shrink-0 items-end border-t border-border bg-card px-4 pt-2 pb-1.5">
      <div className="flex flex-1 items-end">{avant.map(onglet)}</div>
      {fab && (
        <button
          type="button"
          onClick={fab.onPress ?? (() => onNavigate(fab.key))}
          className="mx-1 flex flex-none flex-col items-center gap-1.5 bg-transparent"
        >
          <span className="-mt-5 flex size-[52px] items-center justify-center rounded-[18px] bg-accent text-white shadow-[0_8px_18px_-4px_color-mix(in_srgb,var(--accent)_60%,transparent)]">
            <fab.icon className="size-6" />
          </span>
          <span className="text-[10px] font-semibold text-muted-2">{fab.label}</span>
        </button>
      )}
      <div className="flex flex-1 items-end">{apres.map(onglet)}</div>
    </nav>
  );
}
