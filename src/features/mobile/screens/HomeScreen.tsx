"use client";

import { Bell, ScanLine, Boxes, ChevronRight, Store, MapPin } from "lucide-react";
import { PrimaryHeader } from "../components/MobileHeader";
import { StatusPill } from "../components/StatusPill";
import type { MobileProfile, Parcelle } from "../data/useMobileData";
import { decrireNotif, grouperStatuts, groupeLabel, prenom, type NotifRow, type Tone } from "../data/mappers";

type Props = {
  profile: MobileProfile | null;
  parcelles: Parcelle[];
  notifs: NotifRow[];
  unreadNotif: boolean;
  onOpenParcel: (lotId: string) => void;
  onOpenNotifications: () => void;
  onVerify: () => void;
  onGoParcels: () => void;
  onOpenMarket: () => void;
};

const DOT: Record<Tone, string> = {
  neutral: "bg-muted-2",
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

export function HomeScreen({
  profile,
  parcelles,
  notifs,
  unreadNotif,
  onOpenParcel,
  onOpenNotifications,
  onVerify,
  onGoParcels,
  onOpenMarket,
}: Props) {
  const { enRegle, aSuivre, litige } = grouperStatuts(parcelles.map((p) => p.statut));
  const apercu = parcelles.slice(0, 3);
  const activite = notifs.slice(0, 3).map(decrireNotif);

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
          <span className="pt-0.5 text-[10px] font-semibold tracking-wide opacity-70">Foncier</span>
        </div>
        <div className="mt-4">
          <div className="text-[13px] opacity-80">Bonjour,</div>
          <div className="text-[23px] font-bold leading-tight">{prenom(profile?.nom_complet)}</div>
          <div className="mt-0.5 text-[12px] opacity-75">{groupeLabel(profile?.groupe)}</div>
        </div>
      </PrimaryHeader>

      <div className="sgnf-scroll flex-1 overflow-y-auto px-[18px] pt-[18px] pb-6">
        {/* Actions rapides */}
        <div className="flex gap-3">
          <QuickAction icon={ScanLine} tone="accent" title="Vérifier un titre" sub="Scanner un QR" onClick={onVerify} />
          <QuickAction
            icon={Boxes}
            tone="primary"
            title="Mes parcelles"
            sub={`${parcelles.length} enregistrée${parcelles.length > 1 ? "s" : ""}`}
            onClick={onGoParcels}
          />
        </div>

        {/* Synthèse patrimoine */}
        <div className="mt-4 rounded-[22px] border border-border bg-card p-4 shadow-panel">
          <div className="text-[12px] font-semibold text-muted-foreground">Mon patrimoine foncier</div>
          <div className="mt-1.5 flex items-end gap-2.5">
            <span className="tabular text-[34px] font-extrabold leading-none text-foreground">{parcelles.length}</span>
            <span className="pb-1 text-[13px] text-muted-2">lot{parcelles.length > 1 ? "s" : ""}</span>
          </div>
          <div className="mt-3.5 flex gap-4 border-t border-border pt-3.5">
            <Stat value={enRegle} label="En règle" tone="success" />
            <Stat value={aSuivre} label="À suivre" tone="warning" />
            <Stat value={litige} label="Litige" tone="danger" />
          </div>
        </div>

        {/* Mes parcelles (aperçu) */}
        {apercu.length > 0 && (
          <>
            <SectionTitle title="Mes parcelles" action="Tout voir" onAction={onGoParcels} />
            <div className="flex flex-col gap-2.5">
              {apercu.map((p) => (
                <button
                  key={p.lotId}
                  type="button"
                  onClick={() => onOpenParcel(p.lotId)}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-[13px] text-left shadow-panel"
                >
                  <span className="flex size-11 flex-none items-center justify-center rounded-xl bg-inset text-muted-foreground">
                    <MapPin className="size-[22px]" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold text-foreground">
                      Lot {p.numeroLot ?? "—"}
                      {p.ilotNumero ? ` · Îlot ${p.ilotNumero}` : ""}
                    </span>
                    <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">{p.lotissement}</span>
                  </span>
                  <StatusPill statut={p.statut} />
                </button>
              ))}
            </div>
          </>
        )}

        {/* Activité récente (notifications réelles) */}
        {activite.length > 0 && (
          <>
            <SectionTitle title="Activité récente" />
            <div className="rounded-[18px] border border-border bg-card px-4 shadow-panel">
              {activite.map((a, i) => (
                <div
                  key={a.id}
                  className={`flex gap-3 py-3 ${i < activite.length - 1 ? "border-b border-border" : ""}`}
                >
                  <span className={`mt-1.5 size-2.5 flex-none rounded-full ${DOT[a.tone]}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-foreground">{a.title}</span>
                    {a.body && (
                      <span className="mt-0.5 block text-[11.5px] leading-snug text-muted-foreground">{a.body}</span>
                    )}
                  </span>
                  <span className="flex-none text-[10.5px] text-muted-2">{a.time}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Passerelle marché public */}
        <button
          type="button"
          onClick={onOpenMarket}
          className="mt-5 flex w-full items-center gap-3 rounded-[18px] border border-border bg-card p-4 text-left shadow-panel"
        >
          <span className="flex size-10 flex-none items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--terraci-green)_14%,transparent)] text-terraci-green">
            <Store className="size-5" strokeWidth={1.9} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold text-foreground">Explorer TerraCI Market</span>
            <span className="block text-[11.5px] text-muted-foreground">Terrains disponibles à l&apos;achat</span>
          </span>
          <ChevronRight className="size-5 flex-none text-muted-2" />
        </button>
      </div>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  tone,
  title,
  sub,
  onClick,
}: {
  icon: typeof ScanLine;
  tone: "accent" | "primary";
  title: string;
  sub: string;
  onClick: () => void;
}) {
  const chip =
    tone === "accent"
      ? "bg-accent-subtle text-accent"
      : "bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-primary";
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 flex-col gap-2.5 rounded-[18px] border border-border bg-card p-[15px] text-left shadow-panel"
    >
      <span className={`flex size-[38px] items-center justify-center rounded-xl ${chip}`}>
        <Icon className="size-[21px]" strokeWidth={2} />
      </span>
      <span className="text-[13.5px] font-semibold text-foreground">{title}</span>
      <span className="text-[11px] text-muted-foreground">{sub}</span>
    </button>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone: "success" | "warning" | "danger" }) {
  const color = { success: "text-success", warning: "text-warning", danger: "text-danger" }[tone];
  return (
    <div className="flex-1">
      <div className={`tabular text-[18px] font-bold ${color}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="mt-5 mb-2.5 flex items-center justify-between">
      <span className="text-[15px] font-bold text-foreground">{title}</span>
      {action && (
        <button type="button" onClick={onAction} className="text-[12.5px] font-semibold text-accent">
          {action}
        </button>
      )}
    </div>
  );
}
