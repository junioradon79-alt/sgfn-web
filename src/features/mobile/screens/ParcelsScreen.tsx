"use client";

import { useMemo, useState } from "react";
import { Boxes, Compass, MapPin, Store, X } from "lucide-react";
import { StatusPill } from "../components/StatusPill";
import type { Parcelle, Suivi } from "../data/useMobileData";
import { qualiteLabel, statutLabel } from "../data/mappers";

const TOUTES = "__all__";

export function ParcelsScreen({
  parcelles,
  suivis,
  onOpenParcel,
  onNePlusSuivre,
  onVoirAnnonce,
  onDecouvrir,
}: {
  parcelles: Parcelle[];
  /**
   * Terrains suivis (captage QR). Distincts des parcelles possédées : un
   * acquéreur n'a le plus souvent aucune attribution — cet écran lui restait
   * entièrement vide alors qu'il suit de vrais terrains.
   */
  suivis: Suivi[];
  onOpenParcel: (lotId: string) => void;
  onNePlusSuivre: (lotId: string) => void;
  /** Ouvre l'annonce sur TerraCI Market (hors application). */
  onVoirAnnonce: (annonceId: string | null) => void;
  onDecouvrir: () => void;
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
        {/* 🔴 « Mes parcelles » ne se dit qu'à qui en possède. Un acquéreur qui
            ne fait que SUIVRE des terrains lisait ce titre au-dessus d'une
            liste de biens qui ne sont pas les siens : sur un sujet foncier,
            l'ambiguïté sur la propriété est précisément ce qu'il ne faut pas
            introduire. */}
        <div className="text-[22px] font-extrabold text-foreground">
          {parcelles.length > 0 ? "Mes parcelles" : suivis.length > 0 ? "Terrains suivis" : "Mes parcelles"}
        </div>
        <div className="mt-0.5 text-[12.5px] text-muted-foreground">
          {parcelles.length > 0
            ? // Possédées : le compte, plus le filtre en cours.
              `${parcelles.length} parcelle${parcelles.length > 1 ? "s" : ""} · ${filtreLabel}` +
              (suivis.length > 0 ? ` · ${suivis.length} suivi${suivis.length > 1 ? "s" : ""}` : "")
            : suivis.length > 0
              ? // Le titre dit déjà « Terrains suivis » : ne pas le répéter ici.
                `${suivis.length} terrain${suivis.length > 1 ? "s" : ""}`
              : "Rien pour le moment"}
        </div>
        {/* Les chips filtrent les parcelles possédées : sans aucune, elles
            n'auraient rien à filtrer et occuperaient le haut de l'écran d'un
            acquéreur pour ne rien y faire. */}
        {parcelles.length > 0 && (
          <div className="sgnf-scroll mt-3.5 flex gap-2 overflow-x-auto">
            <Chip label="Toutes" active={filtre === TOUTES} onClick={() => setFiltre(TOUTES)} />
            {statutsPresents.map((s) => (
              <Chip key={s} label={statutLabel(s)} active={filtre === s} onClick={() => setFiltre(s)} />
            ))}
          </div>
        )}
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

        {/* « Aucune parcelle » ne se dit que si l'on en cherchait vraiment une :
            pour un acquéreur qui n'en possède aucune mais suit des terrains, ce
            message occuperait le haut de l'écran au-dessus de son seul contenu
            réel. */}
        {filtrees.length === 0 && parcelles.length > 0 && (
          <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
            <Boxes className="size-7 text-muted-2" />
            <div className="text-[14px] font-semibold text-foreground">Aucune parcelle pour ce filtre</div>
            <div className="text-[12px] text-muted-foreground">
              L&apos;écran ne montre que ce que la base contient pour votre compte.
            </div>
          </div>
        )}

        {/* ── Terrains suivis ──────────────────────────────────────────────
            Le tap n'ouvre PAS le détail de la parcelle, et c'est délibéré :
            un acquéreur n'est autorisé à lire un lot que s'il porte une
            annonce active (`lots_marketplace_public_read`). Les libellés
            ci-dessous ne s'affichent que parce que `mes_suivis()` est
            SECURITY DEFINER. Ouvrir le détail montrerait donc un écran vide
            sur tout terrain pas encore en vente — c'est-à-dire, aujourd'hui,
            sur la totalité d'entre eux. */}
        {suivis.length > 0 && (
          <>
            {/* Le titre de section ne se répète pas quand il fait déjà titre
                d'écran (cas d'un compte sans aucune parcelle possédée). */}
            {parcelles.length > 0 && (
              <div className="mt-4 text-[15px] font-bold text-foreground">Terrains suivis</div>
            )}
            <p className="-mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
              Vous suivez ces terrains sans en être propriétaire. Vous serez prévenu si l&apos;un
              d&apos;eux est mis en vente.
            </p>
            {suivis.map((s) => (
              <div
                key={s.lot_id}
                className="flex items-center gap-3 rounded-[20px] border border-border bg-card p-[15px] shadow-panel"
              >
                <span className="flex size-10 flex-none items-center justify-center rounded-xl bg-inset text-primary">
                  <MapPin className="size-5" strokeWidth={1.9} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14.5px] font-bold text-foreground">
                    Lot {s.numero_lot ?? "—"}
                    {s.ilot_numero ? ` · Îlot ${s.ilot_numero}` : ""}
                  </div>
                  <div className="truncate text-[12px] text-muted-foreground">{s.lotissement ?? "—"}</div>
                  <div className="mt-1">
                    {s.en_vente ? (
                      <button
                        type="button"
                        onClick={() => onVoirAnnonce(s.annonce_id)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-success px-2.5 py-[3px] text-[11px] font-bold text-white"
                      >
                        <Store className="size-3" strokeWidth={2.4} />
                        En vente — voir l&apos;annonce
                      </button>
                    ) : (
                      <span className="text-[11px] text-muted-2">Pas encore en vente</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onNePlusSuivre(s.lot_id)}
                  aria-label={`Ne plus suivre le lot ${s.numero_lot ?? ""}`.trim()}
                  className="flex size-8 flex-none items-center justify-center rounded-full bg-inset text-muted-foreground"
                >
                  <X className="size-4" strokeWidth={2.2} />
                </button>
              </div>
            ))}
          </>
        )}

        {/* Rien du tout : ni bien possédé, ni terrain suivi. */}
        {parcelles.length === 0 && suivis.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
            <Compass className="size-7 text-muted-2" />
            <div className="text-[14px] font-semibold text-foreground">Aucun terrain pour le moment</div>
            <div className="text-[12px] leading-relaxed text-muted-foreground">
              Scannez le QR d&apos;un document pour suivre une parcelle et être prévenu si elle
              est mise en vente.
            </div>
            <button
              type="button"
              onClick={onDecouvrir}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[12.5px] font-semibold text-primary-foreground"
            >
              <Store className="size-4" strokeWidth={2} />
              Découvrir des terrains
            </button>
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
