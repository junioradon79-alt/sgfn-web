"use client";

import { Home, Boxes, ScanLine, MessageSquare, User } from "lucide-react";
import type { Tab } from "../MobileApp";

// Barre d'onglets basse. Le bouton central « Vérifier » est un FAB qui sort du
// flux (le prototype le fait remonter de -20px) et renvoie vers /verifier.

type Props = {
  active: Tab;
  onNavigate: (tab: Tab) => void;
  onVerify: () => void;
  unread: number;
};

export function TabBar({ active, onNavigate, onVerify, unread }: Props) {
  return (
    <nav className="flex shrink-0 items-end justify-between border-t border-border bg-card px-4 pt-2 pb-1.5">
      <TabButton label="Accueil" icon={Home} active={active === "home"} onClick={() => onNavigate("home")} />
      <TabButton label="Parcelles" icon={Boxes} active={active === "parcels"} onClick={() => onNavigate("parcels")} />

      {/* FAB central — Vérifier */}
      <button
        type="button"
        onClick={onVerify}
        className="mx-1 flex flex-none flex-col items-center gap-1.5 bg-transparent"
      >
        <span className="-mt-5 flex size-[52px] items-center justify-center rounded-[18px] bg-accent text-white shadow-[0_8px_18px_-4px_color-mix(in_srgb,var(--accent)_60%,transparent)]">
          <ScanLine className="size-6" />
        </span>
        <span className="text-[10px] font-semibold text-muted-2">Vérifier</span>
      </button>

      <TabButton
        label="Messages"
        icon={MessageSquare}
        active={active === "messages"}
        onClick={() => onNavigate("messages")}
        badge={unread}
      />
      <TabButton label="Profil" icon={User} active={active === "profile"} onClick={() => onNavigate("profile")} />
    </nav>
  );
}

function TabButton({
  label,
  icon: Icon,
  active,
  onClick,
  badge = 0,
}: {
  label: string;
  icon: typeof Home;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 flex-col items-center gap-0.5 bg-transparent ${
        active ? "text-primary" : "text-muted-2"
      }`}
    >
      <span className="relative">
        <Icon className="size-[23px]" strokeWidth={2} />
        {badge > 0 && (
          <span className="tabular absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      <span className="text-[10px] font-semibold">{label}</span>
    </button>
  );
}
