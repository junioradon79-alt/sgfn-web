"use client";

import { Bell, Building2, FileCheck2, Coins, ClipboardList, ChevronRight, Map } from "lucide-react";
import { CountBadge } from "@/components/ds/badge";
import { PrimaryHeader } from "../../components/MobileHeader";
import { fmtFCFA, prenom } from "../../data/mappers";
import type { AdminOverview } from "@/hooks/useAdminOverview";
import type { MobileProfile } from "../../data/useMobileData";

type Props = {
  overview: AdminOverview;
  profile: MobileProfile | null;
  unreadNotif: boolean;
  onOpenNotifications: () => void;
  onOpenFiles: () => void;
  onOpenPerimetres: () => void;
};

export function PilotageScreen({
  overview,
  profile,
  unreadNotif,
  onOpenNotifications,
  onOpenFiles,
  onOpenPerimetres,
}: Props) {
  const { patrimoine, actes, recettes, files, couverture } = overview;
  const aFaire =
    files.saisieAValider + files.demandesATraiter + files.litigesOuverts + files.dossiersAduEnCours;

  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      <PrimaryHeader
        right={
          <button
            type="button"
            onClick={onOpenNotifications}
            aria-label="Notifications"
            className="relative flex size-9 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
          >
            <Bell className="size-5" strokeWidth={1.9} />
            {unreadNotif && (
              <span className="absolute top-1.5 right-2 size-2.5 rounded-full border-2 border-primary bg-warning" />
            )}
          </button>
        }
      >
        <div className="mt-1 flex items-center gap-2">
          <span className="text-[18px] font-extrabold tracking-[0.12em]">SGNF</span>
          <span className="pt-0.5 text-[10px] font-semibold tracking-wide opacity-70">Pilotage</span>
        </div>
        <div className="mt-4">
          <div className="text-[13px] opacity-80">Bonjour,</div>
          <div className="text-[23px] font-bold leading-tight">{prenom(profile?.nom_complet)}</div>
          <div className="mt-0.5 text-[12px] opacity-75">Administration · Centre National de Pilotage</div>
        </div>
      </PrimaryHeader>

      <div className="sgnf-scroll flex-1 overflow-y-auto px-[18px] pt-[18px] pb-6">
        {overview.loading && (
          <div className="mb-3 text-[12px] text-muted-2">Chargement des indicateurs nationaux…</div>
        )}

        {/* Patrimoine national */}
        <div className="rounded-[22px] border border-border bg-card p-4 shadow-panel">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-muted-foreground">
            <Building2 className="size-4 text-primary" />
            Patrimoine national
          </div>
          <div className="mt-1.5 flex items-end gap-2.5">
            <span className="tabular text-[34px] font-extrabold leading-none text-foreground">
              {patrimoine.lots.toLocaleString("fr-FR")}
            </span>
            <span className="pb-1 text-[13px] text-muted-2">lots</span>
            <span className="ml-auto pb-1 text-[11.5px] text-muted-2">
              {patrimoine.lotissements} lotissements · {patrimoine.attributaires} attributaires
            </span>
          </div>
          <div className="mt-3.5 flex gap-4 border-t border-border pt-3.5">
            <Stat value={patrimoine.occupes} label="Occupés" tone="success" />
            <Stat value={patrimoine.libres} label="Libres" tone="warning" />
            <Stat value={patrimoine.enLitige} label="Litige" tone="danger" />
          </div>
        </div>

        {/* Actes + Recettes */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-[18px] border border-border bg-card p-4 shadow-panel">
            <span className="flex size-[34px] items-center justify-center rounded-xl bg-accent-subtle text-accent">
              <FileCheck2 className="size-[19px]" />
            </span>
            <div className="tabular mt-2.5 text-[22px] font-extrabold text-foreground">{actes.delivrees}</div>
            <div className="text-[11.5px] text-muted-foreground">
              attestations délivrées <span className="text-muted-2">/ {actes.attestations}</span>
            </div>
          </div>
          <div className="rounded-[18px] border border-border bg-card p-4 shadow-panel">
            <span className="flex size-[34px] items-center justify-center rounded-xl bg-success-subtle text-success">
              <Coins className="size-[19px]" />
            </span>
            <div className="tabular mt-2.5 text-[19px] font-extrabold text-foreground">{fmtFCFA(recettes.encaisse)}</div>
            <div className="text-[11.5px] text-muted-foreground">
              FCFA encaissés · <span className="tabular">{fmtFCFA(recettes.commissions)}</span> comm.
            </div>
          </div>
        </div>

        {/* À faire — même convention que le web : rouge brique dès qu'une file
            est non vide, pastille compteur, et rien de tout cela si tout est à
            jour. Le téléphone se consulte d'un coup d'œil : c'est l'écran où la
            teinte compte le plus. */}
        <button
          type="button"
          onClick={onOpenFiles}
          className={`mt-4 w-full overflow-hidden rounded-[22px] border text-left shadow-panel ${
            aFaire > 0 ? "border-brick/45 bg-brick-subtle" : "border-border bg-card"
          }`}
        >
          <div
            className={`flex items-center justify-between px-4 py-3 ${
              aFaire > 0 ? "bg-brick" : ""
            }`}
          >
            <div
              className={`flex items-center gap-2 text-[13px] font-bold ${
                aFaire > 0 ? "text-brick-foreground" : "text-foreground"
              }`}
            >
              <ClipboardList
                className={`size-[18px] ${aFaire > 0 ? "text-brick-foreground" : "text-primary"}`}
              />
              À faire
            </div>
            {aFaire > 0 ? (
              <div className="flex items-center gap-1.5">
                <CountBadge tone="inverse" value={aFaire} />
                <ChevronRight className="size-4 text-brick-foreground" />
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[12px] font-semibold text-accent">
                à jour
                <ChevronRight className="size-4" />
              </div>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2 px-4 pt-3 pb-4">
            <Mini value={files.saisieAValider} label="Saisies" />
            <Mini value={files.demandesATraiter} label="Demandes" />
            <Mini value={files.litigesOuverts} label="Litiges" tone="danger" />
            <Mini value={files.dossiersAduEnCours} label="ADU" />
          </div>
        </button>

        {/* Périmètres */}
        <button
          type="button"
          onClick={onOpenPerimetres}
          className="mt-4 flex w-full items-center gap-3 rounded-[18px] border border-border bg-card p-4 text-left shadow-panel"
        >
          <span className="flex size-10 flex-none items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-primary">
            <Map className="size-5" strokeWidth={1.9} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold text-foreground">Périmètres</span>
            <span className="block text-[11.5px] text-muted-foreground">
              {patrimoine.lotissements} lotissements · {Math.round(couverture.taux)}% géolocalisés
            </span>
          </span>
          <ChevronRight className="size-5 flex-none text-muted-2" />
        </button>
      </div>
    </div>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone: "success" | "warning" | "danger" }) {
  const color = { success: "text-success", warning: "text-warning", danger: "text-danger" }[tone];
  return (
    <div className="flex-1">
      <div className={`tabular text-[18px] font-bold ${color}`}>{value.toLocaleString("fr-FR")}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function Mini({ value, label, tone }: { value: number; label: string; tone?: "danger" }) {
  return (
    <div className="rounded-xl bg-inset px-1 py-2 text-center">
      <div className={`tabular text-[17px] font-bold ${tone === "danger" && value > 0 ? "text-danger" : "text-foreground"}`}>
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
