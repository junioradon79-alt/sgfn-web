"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bell, Store, Loader2, MapPin, X, Compass, ChevronRight } from "lucide-react";
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
      <div className="flex items-center justify-center rounded-2xl border border-slate-200/60 bg-white px-5 py-10 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center gap-2">
        <Bell className="h-4 w-4 text-[#0D3B66]" />
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Mes terrains suivis</h2>
        {suivis.length > 0 && (
          <span className="rounded-full bg-[#0D3B66]/10 px-2 py-0.5 text-xs font-bold text-[#0D3B66]">
            {suivis.length}
          </span>
        )}
      </div>

      {suivis.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/60 bg-white px-6 py-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#0D3B66]/5">
            <Compass className="h-6 w-6 text-[#0D3B66]" />
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-800">Aucun terrain suivi pour le moment</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            Parcourez les terrains en vente sur TerraCI Market, ou scannez le QR d&apos;un document
            pour suivre une parcelle et être prévenu si elle est mise en vente.
          </p>
          <a
            href={`${MARKETPLACE_BASE}/annonces/`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-[#0D3B66] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0a2f52]"
          >
            <Store className="h-4 w-4" />
            Découvrir des terrains
          </a>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {suivis.map((s) => (
            <div
              key={s.lot_id}
              className="flex items-center gap-3 rounded-2xl border border-slate-200/60 bg-white px-4 py-3.5 shadow-sm"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0D3B66]/5">
                <MapPin className="h-5 w-5 text-[#0D3B66]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-800">
                  Lot {s.numero_lot ?? "—"}
                  {s.ilot_numero ? ` · Îlot ${s.ilot_numero}` : ""}
                </p>
                <p className="truncate text-xs text-slate-500">{s.lotissement ?? "—"}</p>
              </div>

              {s.en_vente ? (
                <a
                  href={s.annonce_id ? `${MARKETPLACE_BASE}/annonces/${s.annonce_id}/` : `${MARKETPLACE_BASE}/annonces/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#2D8F5A] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-[#24794c]"
                >
                  <Store className="h-3.5 w-3.5" />
                  En vente
                  <ChevronRight className="h-3.5 w-3.5" />
                </a>
              ) : (
                <span className="hidden shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500 sm:inline">
                  Pas encore en vente
                </span>
              )}

              <button
                type="button"
                onClick={() => void nePlusSuivre(s.lot_id)}
                title="Ne plus suivre"
                className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
