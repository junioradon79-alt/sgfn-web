"use client";

import type { ReactNode } from "react";
import { BadgeCheck, Moon, Fingerprint, LogOut, ChevronRight } from "lucide-react";
import { PrimaryHeader } from "../components/MobileHeader";
import type { MobileProfile } from "../data/useMobileData";
import { groupeLabel, initiales } from "../data/mappers";

type Props = {
  profile: MobileProfile | null;
  email: string | null;
  dark: boolean;
  onToggleDark: () => void;
  onLogout: () => void;
  onOpenProfilComplet: () => void;
  biometricEnabled?: boolean;
  onDisableBiometric?: () => void;
};

export function ProfileScreen({
  profile,
  email,
  dark,
  onToggleDark,
  onLogout,
  onOpenProfilComplet,
  biometricEnabled = false,
  onDisableBiometric,
}: Props) {
  const rows: { label: string; value: string }[] = [
    { label: "Nom complet", value: profile?.nom_complet ?? "—" },
    { label: "Adresse e-mail", value: email ?? "—" },
    { label: "Rôle", value: groupeLabel(profile?.groupe) },
  ];

  return (
    <div className="sgnf-scroll absolute inset-0 flex flex-col overflow-y-auto bg-background">
      <PrimaryHeader className="flex items-center gap-[15px] !pb-5" >
        <span className="flex size-[60px] flex-none items-center justify-center rounded-full bg-white/16 text-[21px] font-extrabold">
          {initiales(profile?.nom_complet)}
        </span>
        <div className="min-w-0">
          <div className="truncate text-[19px] font-bold">{profile?.nom_complet ?? "—"}</div>
          <div className="mt-0.5 text-[12.5px] opacity-80">{groupeLabel(profile?.groupe)}</div>
          <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-white/16 px-2.5 py-[3px] text-[11px] font-semibold">
            <BadgeCheck className="size-3.5" strokeWidth={2.4} />
            Identité vérifiée
          </div>
        </div>
      </PrimaryHeader>

      <div className="px-[18px] pt-[18px] pb-7">
        <SectionLabel>Compte</SectionLabel>
        <div className="overflow-hidden rounded-[18px] border border-border bg-card shadow-panel">
          {rows.map((r, i) => (
            <div
              key={r.label}
              className={`flex items-center gap-3 px-4 py-3.5 ${i < rows.length ? "border-b border-border" : ""}`}
            >
              <span className="flex-1 text-[13px] text-muted-foreground">{r.label}</span>
              <span className="max-w-[58%] truncate text-right text-[13px] font-medium text-foreground">{r.value}</span>
            </div>
          ))}
          <button
            type="button"
            onClick={onOpenProfilComplet}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
          >
            <span className="flex-1 text-[14px] font-medium text-foreground">Gérer mon profil</span>
            <ChevronRight className="size-[17px] text-muted-2" />
          </button>
        </div>

        <SectionLabel className="mt-5">Préférences</SectionLabel>
        <div className="flex items-center gap-3 rounded-[18px] border border-border bg-card px-4 py-3.5 shadow-panel">
          <span className="flex size-[34px] flex-none items-center justify-center rounded-[10px] bg-inset text-primary">
            <Moon className="size-[18px]" strokeWidth={2} />
          </span>
          <span className="flex-1">
            <span className="block text-[14px] text-foreground">Thème sombre</span>
            <span className="block text-[11.5px] text-muted-foreground">Neutres inversés · marque inchangée</span>
          </span>
          <button
            type="button"
            onClick={onToggleDark}
            role="switch"
            aria-checked={dark}
            aria-label="Basculer le thème sombre"
            className={`flex h-[27px] w-[46px] flex-none items-center rounded-full p-[3px] transition-colors ${
              dark ? "justify-end bg-primary" : "justify-start bg-border-strong"
            }`}
          >
            <span className="size-[21px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.3)]" />
          </button>
        </div>

        {biometricEnabled && onDisableBiometric && (
          <div className="mt-3 flex items-center gap-3 rounded-[18px] border border-border bg-card px-4 py-3.5 shadow-panel">
            <span className="flex size-[34px] flex-none items-center justify-center rounded-[10px] bg-inset text-primary">
              <Fingerprint className="size-[18px]" strokeWidth={2} />
            </span>
            <span className="flex-1">
              <span className="block text-[14px] text-foreground">Connexion biométrique</span>
              <span className="block text-[11.5px] text-muted-foreground">Activée sur cet appareil</span>
            </span>
            <button
              type="button"
              onClick={onDisableBiometric}
              role="switch"
              aria-checked="true"
              aria-label="Désactiver la connexion biométrique"
              className="flex h-[27px] w-[46px] flex-none items-center justify-end rounded-full bg-primary p-[3px] transition-colors"
            >
              <span className="size-[21px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.3)]" />
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onLogout}
          className="mt-[22px] flex w-full items-center justify-center gap-2 rounded-[14px] border border-border-strong bg-transparent px-4 py-3.5 text-[14.5px] font-semibold text-danger"
        >
          <LogOut className="size-[18px]" strokeWidth={1.9} />
          Se déconnecter
        </button>

        <div className="mt-4 text-center text-[10.5px] text-muted-2">
          SGNF · République de Côte d&apos;Ivoire
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mb-2 text-[12px] font-bold tracking-[0.03em] text-muted-foreground uppercase ${className}`}>
      {children}
    </div>
  );
}
