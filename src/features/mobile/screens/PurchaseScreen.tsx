"use client";

import { useState } from "react";
import { CheckCircle2, Info, Loader2 } from "lucide-react";
import { BarHeader } from "../components/MobileHeader";
import type { Parcelle } from "../data/useMobileData";

export function PurchaseScreen({
  parcelle,
  onBack,
  onConfirm,
}: {
  parcelle: Parcelle | null;
  onBack: () => void;
  onConfirm: (lotId: string) => Promise<boolean>;
}) {
  const [state, setState] = useState<"form" | "sending" | "done">("form");
  const [error, setError] = useState<string | null>(null);

  const nom = parcelle
    ? `Lot ${parcelle.numeroLot ?? "—"}${parcelle.ilotNumero ? ` · Îlot ${parcelle.ilotNumero}` : ""}`
    : "Parcelle";

  const confirmer = async () => {
    if (!parcelle) return;
    setState("sending");
    setError(null);
    const ok = await onConfirm(parcelle.lotId);
    if (ok) setState("done");
    else {
      setError("Votre demande n'a pas pu être enregistrée. Réessayez.");
      setState("form");
    }
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      <BarHeader onBack={onBack} title={<span className="text-[16px] font-bold text-foreground">Acquisition</span>} />

      <div className="sgnf-scroll flex-1 overflow-y-auto p-[18px]">
        {state === "done" ? (
          <div className="flex flex-col items-center gap-4 pt-9 text-center">
            <span className="flex size-[82px] items-center justify-center rounded-full bg-success-subtle text-success">
              <CheckCircle2 className="size-11" strokeWidth={2.2} />
            </span>
            <div className="text-[20px] font-extrabold text-foreground">Demande envoyée</div>
            <div className="max-w-[280px] text-[13.5px] leading-relaxed text-muted-foreground">
              {/* `{" "}` explicite : sans lui le transpileur JSX colle le nom de
                  la parcelle au mot suivant (« Lot 142est enregistré »). */}
              Votre intérêt pour <b className="text-foreground">{nom}</b>{" "}
              est enregistré. La cellule SGNF vous recontactera avec les pièces à fournir.
            </div>
            <button
              type="button"
              onClick={onBack}
              className="mt-2 rounded-[14px] bg-primary px-6 py-3 text-[14.5px] font-semibold text-primary-foreground"
            >
              Retour à la parcelle
            </button>
          </div>
        ) : (
          <>
            <div className="rounded-[22px] border border-border bg-card p-[18px] shadow-panel">
              <div className="text-[16px] font-bold text-foreground">{nom}</div>
              <div className="tabular mt-0.5 text-[12.5px] text-muted-foreground">
                {parcelle?.lotissement ?? "—"}
                {parcelle?.commune ? ` · ${parcelle.commune}` : ""}
              </div>
            </div>

            <div className="mt-4 flex gap-2.5 rounded-[14px] bg-accent-subtle px-3.5 py-3 text-[12px] leading-snug text-accent">
              <Info className="mt-px size-[18px] flex-none" strokeWidth={2} />
              <span>
                La transaction est encadrée par le registre SGNF. Aucun paiement n&apos;est effectué dans
                l&apos;application ; un agent vous accompagne dans la suite.
              </span>
            </div>

            {error && <div className="mt-3 text-[12.5px] font-medium text-danger">{error}</div>}

            <button
              type="button"
              onClick={confirmer}
              disabled={state === "sending" || !parcelle}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-[14px] bg-primary px-4 py-3.5 text-[15px] font-semibold text-primary-foreground shadow-panel disabled:opacity-60"
            >
              {state === "sending" && <Loader2 className="size-4 animate-spin" />}
              Confirmer ma demande
            </button>
          </>
        )}
      </div>
    </div>
  );
}
