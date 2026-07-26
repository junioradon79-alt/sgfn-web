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

/**
 * `lues` est l'état de lecture **figé à l'ouverture** de l'écran (cf.
 * CitizenApp/AdminApp) : les notifications sont marquées lues au moment même
 * où l'on entre ici, si bien que s'appuyer sur l'état courant ferait
 * disparaître la distinction non-lu à l'instant précis où on la regarde.
 */
export function NotificationsScreen({
  notifs,
  lues,
  onBack,
}: {
  notifs: NotifRow[];
  lues: Set<string>;
  onBack: () => void;
}) {
  const items = notifs.map(decrireNotif);
  const nonLues = items.filter((n) => !lues.has(n.id)).length;
  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      <BarHeader
        onBack={onBack}
        title={
          <div className="min-w-0">
            <div className="truncate text-[16px] font-bold text-foreground">Notifications</div>
            {nonLues > 0 && (
              <div className="truncate text-[11.5px] text-muted-foreground">
                {nonLues} nouvelle{nonLues > 1 ? "s" : ""}
              </div>
            )}
          </div>
        }
      />

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
          items.map((n, i) => {
            const nonLue = !lues.has(n.id);
            return (
              // Les marges négatives font déborder la teinte jusqu'aux bords de
              // l'écran : un fond arrêté au ras du texte se lirait comme une
              // carte de plus, pas comme un état.
              <div
                key={n.id}
                className={`-mx-[18px] flex gap-3 px-[18px] py-3.5 ${nonLue ? "bg-inset" : ""} ${
                  i < items.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <span className={`flex size-[38px] flex-none items-center justify-center rounded-xl ${CHIP[n.tone]}`}>
                  <span className={`size-[11px] rounded-full ${DOT[n.tone]}`} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="flex min-w-0 items-baseline gap-1.5">
                      {nonLue && (
                        <span
                          aria-label="Non lue"
                          className="size-[7px] flex-none translate-y-[-1px] rounded-full bg-primary"
                        />
                      )}
                      <span
                        className={`truncate text-[14px] text-foreground ${nonLue ? "font-bold" : "font-semibold"}`}
                      >
                        {n.title}
                      </span>
                    </span>
                    {/* `text-muted-2` mesurait 2,37:1 sur cette ligne — sous AA
                        de très loin, pour une information qu'on lit vraiment.
                        `muted-foreground` est le jeton de texte secondaire du
                        DS ; il plafonne à 4,39:1 en thème clair, soit le
                        maximum atteignable ici sans changer le jeton pour
                        toute l'application (309 usages). */}
                    <span className="flex-none text-[10.5px] text-muted-foreground">{n.time}</span>
                  </div>
                  {n.body && <div className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{n.body}</div>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
