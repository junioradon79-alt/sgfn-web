"use client";

import { BellOff } from "lucide-react";
import { BarHeader } from "../components/MobileHeader";
import { decrireNotif, type NotifRow, type Tone } from "../data/mappers";

const CHIP: Record<Tone, string> = {
  neutral: "bg-inset text-muted-2",
  accent: "bg-accent-subtle text-accent",
  success: "bg-success-subtle text-success",
  warning: "bg-warning-subtle text-warning",
  danger: "bg-danger-subtle text-danger",
};
const DOT: Record<Tone, string> = {
  neutral: "bg-muted-2",
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

export function NotificationsScreen({ notifs, onBack }: { notifs: NotifRow[]; onBack: () => void }) {
  const items = notifs.map(decrireNotif);
  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      <BarHeader onBack={onBack} title={<span className="text-[16px] font-bold text-foreground">Notifications</span>} />

      <div className="sgnf-scroll flex-1 overflow-y-auto px-[18px] pb-6">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
            <BellOff className="size-7 text-muted-2" />
            <div className="text-[14px] font-semibold text-foreground">Aucune notification</div>
            <div className="text-[12px] text-muted-foreground">
              Vous serez prévenu ici à chaque étape de vos démarches foncières.
            </div>
          </div>
        ) : (
          items.map((n, i) => (
            <div key={n.id} className={`flex gap-3 py-3.5 ${i < items.length - 1 ? "border-b border-border" : ""}`}>
              <span className={`flex size-[38px] flex-none items-center justify-center rounded-xl ${CHIP[n.tone]}`}>
                <span className={`size-[11px] rounded-full ${DOT[n.tone]}`} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[14px] font-semibold text-foreground">{n.title}</span>
                  <span className="flex-none text-[10.5px] text-muted-2">{n.time}</span>
                </div>
                {n.body && <div className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{n.body}</div>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
