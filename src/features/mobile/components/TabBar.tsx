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
  return (
    <nav className="flex shrink-0 items-end justify-between border-t border-border bg-card px-4 pt-2 pb-1.5">
      {items.map((it) => {
        const press = it.onPress ?? (() => onNavigate(it.key));
        const Icon = it.icon;
        if (it.fab) {
          return (
            <button
              key={it.key}
              type="button"
              onClick={press}
              className="mx-1 flex flex-none flex-col items-center gap-1.5 bg-transparent"
            >
              <span className="-mt-5 flex size-[52px] items-center justify-center rounded-[18px] bg-accent text-white shadow-[0_8px_18px_-4px_color-mix(in_srgb,var(--accent)_60%,transparent)]">
                <Icon className="size-6" />
              </span>
              <span className="text-[10px] font-semibold text-muted-2">{it.label}</span>
            </button>
          );
        }
        return (
          <button
            key={it.key}
            type="button"
            onClick={press}
            className={`flex flex-1 flex-col items-center gap-0.5 bg-transparent ${
              active === it.key ? "text-primary" : "text-muted-2"
            }`}
          >
            <span className="relative">
              <Icon className="size-[23px]" strokeWidth={2} />
              {it.badge ? (
                <span className="tabular absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                  {it.badge > 99 ? "99+" : it.badge}
                </span>
              ) : null}
            </span>
            <span className="text-[10px] font-semibold">{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
