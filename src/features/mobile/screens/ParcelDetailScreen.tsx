"use client";

import { AlertTriangle, Loader2, ScanLine, MessageSquare, ShieldQuestion } from "lucide-react";
import { PrimaryHeader } from "../components/MobileHeader";
import { ScoreGauge } from "../components/ScoreGauge";
import { useParcelleDetail } from "../data/useMobileData";
import { natureDroitLabel, scoreColor, scoreWord, statutLabel } from "../data/mappers";

type Props = {
  lotId: string;
  onBack: () => void;
  onVerify: () => void;
  onContact: () => void;
  onPurchase: (lotId: string) => void;
  onReport: (lotId: string) => void;
};

export function ParcelDetailScreen({ lotId, onBack, onVerify, onContact, onPurchase, onReport }: Props) {
  const { loading, lot, litiges, score, erreur } = useParcelleDetail(lotId);

  const attr = (lot?.attributions ?? []).find((a) => a.actuel) ?? lot?.attributions?.[0];
  const titulaire = attr?.attributaires?.nom ?? "—";
  const depuis = attr?.depuis ? new Date(attr.depuis).toLocaleDateString("fr-FR") : "—";
  const nom = lot
    ? `Lot ${lot.numero_lot ?? "—"}${lot.ilots?.numero ? ` · Îlot ${lot.ilots.numero}` : ""}`
    : "Parcelle";
  const commune = lot?.ilots?.lotissements?.commune ?? lot?.ilots?.lotissements?.nom ?? "";
  const ref = lot?.numero_parcelle ?? (lot?.numero_lot != null ? `Lot ${lot.numero_lot}` : "—");
  const scoreVal = score?.total ?? null;
  const estLibre = lot?.statut === "libre";

  const infos: { k: string; v: string }[] = [
    { k: "Référence", v: ref },
    { k: "Superficie", v: lot?.superficie_m2 != null ? `${lot.superficie_m2} m²` : "—" },
    { k: "Nature du droit", v: natureDroitLabel(lot?.nature_droit) },
    { k: "Titulaire", v: titulaire },
    { k: "Depuis", v: depuis },
  ];

  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      <PrimaryHeader onBack={onBack} centerTitle="Détail de la parcelle">
        <div className="px-2 pt-3.5">
          <div className="text-[22px] font-extrabold leading-tight">{nom}</div>
          <div className="tabular mt-0.5 text-[13px] opacity-80">
            {ref}
            {commune ? ` · ${commune}` : ""}
          </div>
          <div className="mt-3 inline-flex">
            <span className="rounded-full bg-white/15 px-3 py-[5px] text-[12px] font-semibold">
              {statutLabel(lot?.statut)}
            </span>
          </div>
        </div>
      </PrimaryHeader>

      <div className="sgnf-scroll flex flex-1 flex-col gap-3.5 overflow-y-auto px-[18px] pt-4 pb-7">
        {loading && !lot ? (
          <div className="flex flex-1 items-center justify-center py-16 text-muted-2">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : (
          <>
            {/* Une fiche muette (score « Non calculé », aucun litige, titulaire
                « — ») ne doit jamais passer pour une parcelle saine quand c'est
                la lecture qui a été refusée. */}
            {erreur && (
              <p
                role="alert"
                className="rounded-[18px] border border-danger/30 bg-danger-subtle px-4 py-3 text-[12.5px] font-medium leading-snug text-danger"
              >
                Fiche INCOMPLÈTE — {erreur}
              </p>
            )}

            {/* Indice de confiance */}
            <div className="flex items-center gap-[18px] rounded-[22px] border border-border bg-card p-[18px] shadow-panel">
              {scoreVal != null ? (
                <ScoreGauge score={scoreVal} />
              ) : (
                <div className="flex size-[110px] flex-none items-center justify-center rounded-full bg-inset text-muted-2">
                  {loading ? <Loader2 className="size-6 animate-spin" /> : <ShieldQuestion className="size-8" />}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold text-muted-foreground">Indice de confiance</div>
                <div
                  className="mt-0.5 text-[17px] font-extrabold"
                  style={{ color: scoreVal != null ? scoreColor(scoreVal) : "var(--muted-2)" }}
                >
                  {scoreVal != null ? scoreWord(scoreVal) : "Non calculé"}
                </div>
                <div className="mt-1.5 text-[11.5px] leading-snug text-muted-foreground">
                  Fondé sur l&apos;APFC, le guide de répartition et les PV du dossier foncier.
                </div>
              </div>
            </div>

            {/* Plan cadastral — schématique */}
            <div className="overflow-hidden rounded-[22px] border border-border bg-card shadow-panel">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <span className="text-[13px] font-bold text-foreground">Plan cadastral</span>
                <span className="text-[10.5px] text-muted-2">schématique</span>
              </div>
              <div className="relative h-40 bg-inset">
                <svg viewBox="0 0 320 160" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
                  <path d="M-10 120 L120 40 L340 96" fill="none" stroke="var(--border-strong)" strokeWidth="10" opacity=".7" />
                  <path d="M60 -10 L110 170" fill="none" stroke="var(--border-strong)" strokeWidth="8" opacity=".5" />
                  <polygon points="20,50 90,30 105,80 40,100" fill="var(--card)" stroke="var(--border-strong)" strokeWidth="1.5" />
                  <polygon points="120,44 190,30 205,74 135,90" fill="var(--card)" stroke="var(--border-strong)" strokeWidth="1.5" />
                  <polygon points="150,96 230,78 250,130 172,148" fill="color-mix(in srgb,var(--primary) 16%,transparent)" stroke="var(--primary)" strokeWidth="2.5" />
                  <polygon points="250,66 312,52 320,104 262,120" fill="var(--card)" stroke="var(--border-strong)" strokeWidth="1.5" />
                  <circle cx="205" cy="108" r="7" fill="var(--primary)" />
                  <circle cx="205" cy="108" r="13" fill="none" stroke="var(--primary)" strokeWidth="2" opacity=".4" />
                </svg>
                <div className="absolute bottom-2.5 left-3 rounded-lg border border-border bg-elevated px-2.5 py-1 text-[10.5px] text-muted-foreground shadow-float">
                  Lot mis en évidence
                </div>
              </div>
            </div>

            {/* Informations */}
            <div className="rounded-[22px] border border-border bg-card px-4 shadow-panel">
              {infos.map((i, idx) => (
                <div
                  key={i.k}
                  className={`flex items-center justify-between py-3 ${idx < infos.length - 1 ? "border-b border-border" : ""}`}
                >
                  <span className="text-[13px] text-muted-foreground">{i.k}</span>
                  <span className="tabular text-right text-[13.5px] font-semibold text-foreground">{i.v}</span>
                </div>
              ))}
            </div>

            {/* Litiges éventuels */}
            {litiges.length > 0 && (
              <div className="rounded-[22px] border border-danger/30 bg-danger-subtle px-4 py-3.5">
                <div className="text-[13px] font-bold text-danger">
                  {litiges.length} litige{litiges.length > 1 ? "s" : ""} sur cette parcelle
                </div>
                {litiges.slice(0, 3).map((l) => (
                  <div key={l.id} className="mt-1.5 text-[12px] text-danger/90">
                    {l.objet ?? "Litige"} · {l.statut ?? "—"}
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="mt-1 flex flex-col gap-2.5">
              {estLibre && (
                <button
                  type="button"
                  onClick={() => onPurchase(lotId)}
                  className="w-full rounded-[14px] bg-primary px-4 py-3.5 text-[15px] font-semibold text-primary-foreground shadow-panel"
                >
                  Manifester mon intérêt
                </button>
              )}
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={onVerify}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-[14px] border border-border-strong bg-card px-3 py-3 text-[14px] font-semibold text-foreground"
                >
                  <ScanLine className="size-[17px]" />
                  Vérifier QR
                </button>
                <button
                  type="button"
                  onClick={onContact}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-[14px] border border-border-strong bg-card px-3 py-3 text-[14px] font-semibold text-foreground"
                >
                  <MessageSquare className="size-[17px]" />
                  Contacter
                </button>
              </div>
              {/* En retrait des actions courantes : signaler engage un
                  traitement humain, ce n'est pas un geste à faire par erreur. */}
              <button
                type="button"
                onClick={() => onReport(lotId)}
                className="flex w-full items-center justify-center gap-1.5 rounded-[14px] border border-danger/30 bg-danger-subtle px-4 py-3 text-[14px] font-semibold text-danger"
              >
                <AlertTriangle className="size-[17px]" strokeWidth={2} />
                Signaler un problème
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
