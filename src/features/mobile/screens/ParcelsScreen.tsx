"use client";

import { useMemo, useState } from "react";
import { Boxes } from "lucide-react";
import { StatusPill } from "../components/StatusPill";
import type { Parcelle } from "../data/useMobileData";
import { qualiteLabel, statutLabel } from "../data/mappers";

const TOUTES = "__all__";

export function ParcelsScreen({
  parcelles,
  onOpenParcel,
}: {
  parcelles: Parcelle[];
  onOpenParcel: (lotId: string) => void;
}) {
  const [filtre, setFiltre] = useState<string>(TOUTES);

  // Chips dérivées des statuts réellement présents (pas de liste figée).
  const statutsPresents = useMemo(() => {
    const set = new Set<string>();
    parcelles.forEach((p) => set.add(p.statut));
    return [...set];
  }, [parcelles]);

  const filtrees = filtre === TOUTES ? parcelles : parcelles.filter((p) => p.statut === filtre);
  const filtreLabel = filtre === TOUTES ? "toutes" : statutLabel(filtre);

  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      <div className="flex-none px-[18px] pt-2 pb-3">
        <div className="text-[22px] font-extrabold text-foreground">Mes parcelles</div>
        <div className="mt-0.5 text-[12.5px] text-muted-foreground">
          {parcelles.length} parcelle{parcelles.length > 1 ? "s" : ""} · {filtreLabel}
        </div>
        <div className="sgnf-scroll mt-3.5 flex gap-2 overflow-x-auto">
          <Chip label="Toutes" active={filtre === TOUTES} onClick={() => setFiltre(TOUTES)} />
          {statutsPresents.map((s) => (
            <Chip key={s} label={statutLabel(s)} active={filtre === s} onClick={() => setFiltre(s)} />
          ))}
        </div>
      </div>

      <div className="sgnf-scroll flex flex-1 flex-col gap-3 overflow-y-auto px-[18px] pt-1.5 pb-6">
        {filtrees.map((p) => {
          const qual = qualiteLabel(p.qualite);
          return (
            <button
              key={p.lotId}
              type="button"
              onClick={() => onOpenParcel(p.lotId)}
              className="w-full rounded-[20px] border border-border bg-card p-[15px] text-left shadow-panel"
            >
              <div className="flex items-start justify-between gap-2.5">
                <div className="min-w-0">
                  <div className="text-[15px] font-bold text-foreground">
                    Lot {p.numeroLot ?? "—"}
                    {p.ilotNumero ? ` · Îlot ${p.ilotNumero}` : ""}
                  </div>
                  <div className="mt-0.5 truncate text-[12px] text-muted-foreground">{p.lotissement}</div>
                </div>
                <StatusPill statut={p.statut} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-muted-foreground">
                {p.commune && <span>{p.commune}</span>}
                {p.commune && qual && <span>·</span>}
                {qual && <span>{qual}</span>}
                {p.collectif && (
                  <>
                    <span>·</span>
                    <span className="text-muted-2">Collectif de la famille</span>
                  </>
                )}
              </div>
            </button>
          );
        })}

        {filtrees.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
            <Boxes className="size-7 text-muted-2" />
            <div className="text-[14px] font-semibold text-foreground">Aucune parcelle pour ce filtre</div>
            <div className="text-[12px] text-muted-foreground">
              L&apos;écran ne montre que ce que la base contient pour votre compte.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-none rounded-full border px-3.5 py-[7px] text-[12.5px] font-semibold whitespace-nowrap transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border-strong bg-card text-muted-foreground"
      }`}
    >
      {label}
    </button>
  );
}
