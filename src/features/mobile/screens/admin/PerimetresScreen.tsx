"use client";

import { MapPin } from "lucide-react";
import { BarHeader } from "../../components/MobileHeader";
import type { AdminOverview } from "@/hooks/useAdminOverview";

export function PerimetresScreen({ overview, onBack }: { overview: AdminOverview; onBack: () => void }) {
  const perimetres = overview.couverture.perimetres;

  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      <BarHeader onBack={onBack} title={<span className="text-[16px] font-bold text-foreground">Périmètres</span>} />

      <div className="sgnf-scroll flex flex-1 flex-col gap-3 overflow-y-auto px-[18px] pt-4 pb-6">
        <div className="text-[12.5px] text-muted-foreground">
          {perimetres.length} lotissement{perimetres.length > 1 ? "s" : ""} · triés par volume de lots
        </div>

        {perimetres.map((p) => (
          <div key={p.id} className="rounded-[20px] border border-border bg-card p-4 shadow-panel">
            <div className="flex items-start justify-between gap-2.5">
              <div className="min-w-0">
                <div className="truncate text-[15px] font-bold text-foreground">{p.nom}</div>
                <div className="mt-0.5 flex items-center gap-1 text-[12px] text-muted-foreground">
                  <MapPin className="size-3.5" />
                  {[p.commune, p.village].filter(Boolean).join(" · ") || "Localisation non renseignée"}
                </div>
              </div>
              <span className="tabular shrink-0 text-right text-[13px] font-semibold text-foreground">
                {p.lots} lot{p.lots > 1 ? "s" : ""}
              </span>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-inset">
                <div className="h-full rounded-full bg-success" style={{ width: `${p.tauxOccupation}%` }} />
              </div>
              <span className="tabular text-[12px] font-bold text-success">{p.tauxOccupation}%</span>
            </div>
            <div className="mt-2 flex gap-3 text-[11.5px] text-muted-foreground">
              <span className="tabular">{p.occupes} occupés</span>
              <span>·</span>
              <span className="tabular">{p.libres} libres</span>
              {p.enLitige > 0 && (
                <>
                  <span>·</span>
                  <span className="tabular text-danger">{p.enLitige} litige{p.enLitige > 1 ? "s" : ""}</span>
                </>
              )}
            </div>
          </div>
        ))}

        {perimetres.length === 0 && !overview.loading && (
          <div className="py-14 text-center text-[13px] text-muted-foreground">Aucun périmètre à afficher.</div>
        )}
      </div>
    </div>
  );
}
