"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bell, Store, Loader2, MapPin, X, Compass, ChevronRight } from "lucide-react";

import { Button } from "@/components/ds/button";
import { Card } from "@/components/ds/card";
import { EmptyState } from "@/components/ds/empty-state";
import { createClient } from "@/utils/supabase/client";

// Marketplace public (TerraCI Market) — la découverte des annonces y vit.
const MARKETPLACE_BASE = "https://monterrain.sgfn.ci";

type Suivi = {
  lot_id: string;
  numero_lot: string | null;
  ilot_numero: string | null;
  lotissement: string | null;
  en_vente: boolean;
  annonce_id: string | null;
  cree_le: string;
};

/**
 * « Mes terrains suivis » — cœur du dashboard acquéreur (captage de leads).
 * Liste les parcelles que l'acquéreur suit et signale celles passées en vente
 * sur TerraCI Market. Enregistre aussi le suivi à l'arrivée depuis l'invite de
 * /verifier (query `?suivi=<référence>`), puis nettoie l'URL.
 */
export default function ParcellesSuivies() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const suiviParam = searchParams.get("suivi");

  const [suivis, setSuivis] = useState<Suivi[]>([]);
  const [loading, setLoading] = useState(true);

  const charger = useCallback(async () => {
    const { data } = await supabase.rpc("mes_suivis");
    setSuivis((data ?? []) as Suivi[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void (async () => {
      // Arrivée depuis l'invite /verifier : on enregistre le suivi puis on retire
      // le paramètre de l'URL (sans recharger la page).
      if (suiviParam) {
        await supabase.rpc("suivre_parcelle", { p_reference: suiviParam });
        router.replace("/dashboard/mon-achat");
      }
      await charger();
    })();
    // Volontairement au montage seulement (le nettoyage d'URL éviterait une boucle).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nePlusSuivre = async (lotId: string) => {
    // RLS : la suppression est scopée à profile_id = auth.uid().
    await supabase.from("suivis_parcelle").delete().eq("lot_id", lotId);
    setSuivis((s) => s.filter((x) => x.lot_id !== lotId));
  };

  if (loading) {
    return (
      <Card className="flex items-center justify-center px-5 py-10 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-hidden />
      </Card>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Bell className="text-accent size-4" aria-hidden />
        <h2 className="text-[11px] font-bold tracking-[0.18em] text-muted-foreground uppercase">
          Mes terrains suivis
        </h2>
        {suivis.length > 0 && (
          <span className="bg-accent-subtle text-accent rounded-full px-2 py-0.5 text-xs font-bold">
            {suivis.length}
          </span>
        )}
      </div>

      {suivis.length === 0 ? (
        <Card className="pb-8">
          <EmptyState
            icon={Compass}
            title="Aucun terrain suivi pour le moment"
            description="Parcourez les terrains en vente sur TerraCI Market, ou scannez le QR d'un document pour suivre une parcelle et être prévenu si elle est mise en vente."
            className="pb-0"
          />
          {/* CTA rendu ici plutôt que via `action` d'EmptyState : c'est l'action
              principale de l'écran (bouton plein, pas `outline`) et elle sort du
              domaine — elle a besoin de target/rel. */}
          <Button asChild variant="primary" className="mt-4 self-center">
            <a href={`${MARKETPLACE_BASE}/annonces/`} target="_blank" rel="noopener noreferrer">
              <Store className="size-4" aria-hidden />
              Découvrir des terrains
            </a>
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {suivis.map((s) => (
            <Card key={s.lot_id} className="flex-row items-center gap-3 px-4 py-3.5">
              <div className="bg-accent-subtle flex size-10 shrink-0 items-center justify-center rounded-xl">
                <MapPin className="text-accent size-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-foreground">
                  Lot {s.numero_lot ?? "—"}
                  {s.ilot_numero ? ` · Îlot ${s.ilot_numero}` : ""}
                </p>
                <p className="truncate text-xs text-muted-foreground">{s.lotissement ?? "—"}</p>
              </div>

              {s.en_vente ? (
                <Button
                  asChild
                  size="sm"
                  variant="primary"
                  className="bg-success hover:bg-success/90 shrink-0 rounded-xl text-white"
                >
                  <a
                    href={s.annonce_id ? `${MARKETPLACE_BASE}/annonces/${s.annonce_id}/` : `${MARKETPLACE_BASE}/annonces/`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Store className="size-3.5" aria-hidden />
                    En vente
                    <ChevronRight className="size-3.5" aria-hidden />
                  </a>
                </Button>
              ) : (
                <span className="hidden shrink-0 rounded-full border border-border bg-inset px-2.5 py-1 text-xs font-medium text-muted-foreground sm:inline">
                  Pas encore en vente
                </span>
              )}

              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => void nePlusSuivre(s.lot_id)}
                title="Ne plus suivre"
                aria-label={`Ne plus suivre le lot ${s.numero_lot ?? ""}`.trim()}
                className="shrink-0"
              >
                <X className="size-4" aria-hidden />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
