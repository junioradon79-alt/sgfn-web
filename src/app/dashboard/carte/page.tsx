"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Boxes, Building2, CheckCircle2, List, Loader2, Map, MapPin, MapPinOff,
  Maximize2, Search,
} from "lucide-react";

import { AppShell } from "@/components/pilotage/AppShell";
import { Card } from "@/components/ds/card";
import { Input } from "@/components/ds/input";
import { createClient } from "@/utils/supabase/client";
import { useBadgeCounts } from "@/hooks/useBadgeCounts";
import type { LotissementGeo } from "./_CarteMap";

// Import dynamique — Leaflet a besoin des APIs browser (window, document)
const CarteMap = dynamic(() => import("./_CarteMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-inset">
      <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
    </div>
  ),
});

export default function CartePage() {
  const supabase = useMemo(() => createClient(), []);
  const { counts } = useBadgeCounts();

  const [lotissements, setLotissements] = useState<LotissementGeo[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const [placementMode, setPlacementMode] = useState(false);
  const [isAdmin, setIsAdmin]           = useState(false);
  const [saving, setSaving]             = useState(false);
  const [saveMsg, setSaveMsg]           = useState<string | null>(null);
  const [mobileTab, setMobileTab]       = useState<"liste" | "carte">("carte");
  const [tick, setTick]                 = useState(0);

  // Charger lotissements + rôle
  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: lots }, { data: profile }] = await Promise.all([
        supabase
          .from("lotissements")
          .select("id, nom, village, commune, nb_lots, nb_ilots, superficie_texte, latitude, longitude")
          .order("nom"),
        supabase.from("profiles").select("groupe").maybeSingle(),
      ]);
      setLotissements((lots ?? []) as LotissementGeo[]);
      setIsAdmin(profile?.groupe === "admin");
      setLoading(false);
    })();
  }, [supabase, tick]);

  // Placement : clic sur la carte → mettre à jour les coordonnées en DB
  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    if (!placementMode || !selectedId) return;
    setSaving(true);
    setSaveMsg(null);

    const { error } = await supabase
      .from("lotissements")
      .update({ latitude: lat, longitude: lng })
      .eq("id", selectedId);

    if (error) {
      setSaveMsg("Erreur lors de l'enregistrement.");
    } else {
      setLotissements((prev) =>
        prev.map((l) => (l.id === selectedId ? { ...l, latitude: lat, longitude: lng } : l)),
      );
      setSaveMsg("Position enregistrée ✓");
      setTimeout(() => setSaveMsg(null), 3000);
    }
    setSaving(false);
  }, [placementMode, selectedId, supabase]);

  const filtered = lotissements.filter((l) => {
    const q = search.toLowerCase();
    return !q || l.nom.toLowerCase().includes(q) || (l.village ?? "").toLowerCase().includes(q);
  });

  const withCoords    = lotissements.filter((l) => l.latitude && l.longitude).length;
  const withoutCoords = lotissements.length - withCoords;
  const selected      = lotissements.find((l) => l.id === selectedId) ?? null;

  return (
    // `wide` : la carte est le contenu, pas un panneau dans une colonne de
    // lecture — même traitement que le Centre de pilotage.
    <AppShell loading={loading} counts={counts} onRefresh={() => setTick((t) => t + 1)} wide>
      <div>
        <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-tight text-foreground">
          Carte foncière
        </h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">
          Position géographique des lotissements — fond OpenStreetMap, coordonnées WGS-84.
        </p>
      </div>

      {/* Hauteur bornée à la fenêtre : la carte doit tenir à l'écran sans que la
          page défile, et le panneau latéral défile chez lui. */}
      <Card className="h-[calc(100vh-15rem)] min-h-[560px] flex-row overflow-hidden max-lg:flex-col">
        {/* ── Onglets mobile ── */}
        <div className="flex shrink-0 border-b border-border lg:hidden">
          {([["carte", Map, "Carte"], ["liste", List, "Liste"]] as const).map(([cle, Icone, libelle]) => (
            <button
              key={cle}
              type="button"
              onClick={() => setMobileTab(cle)}
              aria-pressed={mobileTab === cle}
              className={`flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors ${
                mobileTab === cle
                  ? "border-b-2 border-primary text-primary"
                  : "border-b-2 border-transparent text-muted-foreground"
              }`}
            >
              <Icone className="size-4" aria-hidden /> {libelle}
            </button>
          ))}
        </div>

        {/* ── Panneau gauche ── */}
        <div
          className={`flex w-full shrink-0 flex-col border-border bg-inset/50 max-lg:min-h-0 lg:w-72 lg:border-r xl:w-80 ${
            mobileTab === "liste" ? "flex" : "max-lg:hidden"
          }`}
        >
          <div className="border-b border-border px-4 py-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-border bg-card px-3 py-2 text-center">
                <p className="tabular text-lg font-bold text-foreground">{withCoords}</p>
                <p className="text-xs text-muted-2">positionnés</p>
              </div>
              <div className={`rounded-xl border px-3 py-2 text-center ${
                withoutCoords > 0 ? "border-warning/25 bg-warning-subtle" : "border-border bg-card"
              }`}>
                <p className={`tabular text-lg font-bold ${withoutCoords > 0 ? "text-warning" : "text-muted-2"}`}>
                  {withoutCoords}
                </p>
                <p className="text-xs text-muted-2">sans position</p>
              </div>
            </div>

            <div className="relative mt-3">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                placeholder="Rechercher…"
                className="pl-9"
                aria-label="Rechercher un lotissement"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Mode placement (admin) */}
          {isAdmin && (
            <div className="border-b border-border px-4 py-3">
              <button
                type="button"
                onClick={() => setPlacementMode((p) => !p)}
                aria-pressed={placementMode}
                className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors ${
                  placementMode
                    ? "border-warning/40 bg-warning-subtle text-warning"
                    : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
                }`}
              >
                <span className="flex items-center gap-2">
                  <MapPin className="size-3.5" aria-hidden />
                  {placementMode ? "Mode placement ACTIF" : "Positionner un lotissement"}
                </span>
                {placementMode && (
                  <span className="rounded-full bg-warning/20 px-2 py-0.5">Cliquez sur la carte</span>
                )}
              </button>
              {placementMode && !selected && (
                <p className="mt-1.5 text-xs text-warning">Sélectionnez d&apos;abord un lotissement dans la liste.</p>
              )}
              {placementMode && selected && (
                <p className="mt-1.5 text-xs text-warning">
                  Clic sur la carte → positionne <strong>{selected.nom}</strong>
                </p>
              )}
              {saving && (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" aria-hidden /> Enregistrement…
                </p>
              )}
              {saveMsg && (
                <p role="status" className="mt-1.5 flex items-center gap-1 text-xs text-success">
                  <CheckCircle2 className="size-3" aria-hidden /> {saveMsg}
                </p>
              )}
            </div>
          )}

          {/* Liste des lotissements */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
              </div>
            ) : filtered.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-2">Aucun lotissement.</p>
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((lot) => {
                  const hasCoords = !!(lot.latitude && lot.longitude);
                  const isSelected = lot.id === selectedId;
                  return (
                    <li key={lot.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(lot.id)}
                        aria-current={isSelected || undefined}
                        className={`flex w-full items-start gap-3 border-l-2 px-4 py-3.5 text-left transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-transparent hover:bg-inset"
                        }`}
                      >
                        <span className={`mt-0.5 shrink-0 ${hasCoords ? "text-primary" : "text-warning"}`}>
                          {hasCoords ? <MapPin className="size-4" aria-hidden /> : <MapPinOff className="size-4" aria-hidden />}
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-foreground">{lot.nom}</p>
                          {lot.village && (
                            <p className="mt-0.5 truncate text-xs text-muted-2">
                              {lot.village}{lot.commune ? ` · ${lot.commune}` : ""}
                            </p>
                          )}
                          <div className="mt-1.5 flex flex-wrap gap-2">
                            {lot.nb_ilots ? (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <Maximize2 className="size-3" aria-hidden /> {lot.nb_ilots} îlots
                              </span>
                            ) : null}
                            {lot.nb_lots ? (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <Boxes className="size-3" aria-hidden /> {lot.nb_lots} lots
                              </span>
                            ) : null}
                          </div>
                          {hasCoords ? (
                            <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-success/25 bg-success-subtle px-2 py-0.5 text-xs text-success">
                              <CheckCircle2 className="size-3" aria-hidden /> Sur la carte
                            </span>
                          ) : (
                            <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-warning/25 bg-warning-subtle px-2 py-0.5 text-xs text-warning">
                              <AlertTriangle className="size-3" aria-hidden /> Non positionné
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-border px-4 py-3">
            <p className="text-xs text-muted-2">
              Fond de carte :{" "}
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-muted-foreground"
              >
                OpenStreetMap
              </a>{" "}
              · WGS-84
            </p>
          </div>
        </div>

        {/* ── Panneau droit : carte ── */}
        <div className={`relative min-h-0 min-w-0 flex-1 flex-col ${mobileTab === "carte" ? "flex" : "max-lg:hidden"} lg:flex`}>
          {placementMode && (
            <div className="absolute top-4 left-1/2 z-[999] -translate-x-1/2 rounded-full border border-warning/40 bg-warning-subtle px-4 py-2 text-xs font-semibold text-warning shadow-float">
              <MapPin className="mr-1.5 inline size-3.5" aria-hidden />
              Mode placement actif — cliquez sur la carte pour positionner{" "}
              {selected ? <strong>{selected.nom}</strong> : "le lotissement sélectionné"}
            </div>
          )}

          {!loading && withCoords === 0 && !placementMode && (
            <div className="absolute inset-0 z-[500] flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <div className="max-w-xs rounded-xl border border-border bg-card p-6 text-center shadow-float">
                <Building2 className="mx-auto mb-3 size-8 text-muted-2" aria-hidden />
                <p className="font-semibold text-foreground">Aucun lotissement positionné</p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Sélectionnez un lotissement dans la liste et activez le{" "}
                  <strong>Mode placement</strong> pour le placer sur la carte.
                </p>
              </div>
            </div>
          )}

          <CarteMap
            lotissements={lotissements}
            selectedId={selectedId}
            placementMode={placementMode}
            onLotissementClick={setSelectedId}
            onMapClick={handleMapClick}
          />
        </div>
      </Card>
    </AppShell>
  );
}
