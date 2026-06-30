"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import {
  Map, MapPin, MapPinOff, Search, Loader2, AlertTriangle,
  Building2, Boxes, Maximize2, CheckCircle2,
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import type { LotissementGeo } from "./_CarteMap";

// Import dynamique — Leaflet a besoin des APIs browser (window, document)
const CarteMap = dynamic(() => import("./_CarteMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-slate-100">
      <Loader2 className="h-6 w-6 animate-spin text-[#0D3B66]" />
    </div>
  ),
});

export default function CartePage() {
  const supabase = createClient();
  const [lotissements, setLotissements] = useState<LotissementGeo[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const [placementMode, setPlacementMode] = useState(false);
  const [isAdmin, setIsAdmin]           = useState(false);
  const [saving, setSaving]             = useState(false);
  const [saveMsg, setSaveMsg]           = useState<string | null>(null);

  // Charger lotissements + rôle
  useEffect(() => {
    (async () => {
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
  }, []);

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
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">

      {/* ── Panneau gauche ── */}
      <div className="flex w-72 shrink-0 flex-col border-r border-slate-100 bg-slate-50/40 xl:w-80">

        {/* Header */}
        <div className="border-b border-slate-100 px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0D3B66]/10">
              <Map className="h-4 w-4 text-[#0D3B66]" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-[#0D3B66]">Carte foncière</h1>
              <p className="text-xs text-slate-400">OpenStreetMap · Ebimpé</p>
            </div>
          </div>

          {/* KPIs */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-slate-100 bg-white px-3 py-2 text-center shadow-sm">
              <p className="text-lg font-bold text-[#0D3B66]">{withCoords}</p>
              <p className="text-xs text-slate-400">positionnés</p>
            </div>
            <div className={`rounded-xl border px-3 py-2 text-center shadow-sm ${withoutCoords > 0 ? "border-amber-100 bg-amber-50" : "border-slate-100 bg-white"}`}>
              <p className={`text-lg font-bold ${withoutCoords > 0 ? "text-amber-600" : "text-slate-300"}`}>{withoutCoords}</p>
              <p className="text-xs text-slate-400">sans position</p>
            </div>
          </div>

          {/* Recherche */}
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Rechercher…"
              className="pl-9 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Mode placement (admin) */}
        {isAdmin && (
          <div className="border-b border-slate-100 px-4 py-3">
            <button
              onClick={() => setPlacementMode((p) => !p)}
              className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
                placementMode
                  ? "border-amber-300 bg-amber-50 text-amber-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-[#0D3B66]/30 hover:text-[#0D3B66]"
              }`}
            >
              <span className="flex items-center gap-2">
                <MapPin className={`h-3.5 w-3.5 ${placementMode ? "text-amber-600" : ""}`} />
                {placementMode ? "Mode placement ACTIF" : "Positionner un lotissement"}
              </span>
              {placementMode && (
                <span className="rounded-full bg-amber-200 px-2 py-0.5 text-amber-800">
                  Cliquez sur la carte
                </span>
              )}
            </button>
            {placementMode && !selected && (
              <p className="mt-1.5 text-xs text-amber-600">Sélectionnez d&apos;abord un lotissement dans la liste.</p>
            )}
            {placementMode && selected && (
              <p className="mt-1.5 text-xs text-amber-700">
                Clic sur la carte → positionne <strong>{selected.nom}</strong>
              </p>
            )}
            {saving && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-500">
                <Loader2 className="h-3 w-3 animate-spin" /> Enregistrement…
              </p>
            )}
            {saveMsg && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-600">
                <CheckCircle2 className="h-3 w-3" /> {saveMsg}
              </p>
            )}
          </div>
        )}

        {/* Liste des lotissements */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">Aucun lotissement.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((lot) => {
                const hasCoords = !!(lot.latitude && lot.longitude);
                const isSelected = lot.id === selectedId;
                return (
                  <li key={lot.id}>
                    <button
                      onClick={() => {
                        setSelectedId(lot.id);
                      }}
                      className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition ${
                        isSelected
                          ? "border-l-2 border-[#0D3B66] bg-[#0D3B66]/5"
                          : "border-l-2 border-transparent hover:bg-slate-50"
                      }`}
                    >
                      {/* Icône position */}
                      <span className={`mt-0.5 shrink-0 ${hasCoords ? "text-[#0D3B66]" : "text-amber-400"}`}>
                        {hasCoords ? <MapPin className="h-4 w-4" /> : <MapPinOff className="h-4 w-4" />}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">{lot.nom}</p>
                        {lot.village && (
                          <p className="mt-0.5 truncate text-xs text-slate-400">{lot.village}{lot.commune ? ` · ${lot.commune}` : ""}</p>
                        )}
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          {lot.nb_ilots ? (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                              <Maximize2 className="h-3 w-3" /> {lot.nb_ilots} îlots
                            </span>
                          ) : null}
                          {lot.nb_lots ? (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                              <Boxes className="h-3 w-3" /> {lot.nb_lots} lots
                            </span>
                          ) : null}
                        </div>
                        {!hasCoords && (
                          <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-600">
                            <AlertTriangle className="h-3 w-3" /> Non positionné
                          </span>
                        )}
                        {hasCoords && (
                          <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-600">
                            <CheckCircle2 className="h-3 w-3" /> Sur la carte
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

        {/* Footer OSM */}
        <div className="border-t border-slate-100 px-4 py-3">
          <p className="text-xs text-slate-300">
            Fond de carte :{" "}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline hover:text-slate-500">
              OpenStreetMap
            </a>{" "}
            · WGS-84
          </p>
        </div>
      </div>

      {/* ── Panneau droit : carte ── */}
      <div className="relative min-w-0 flex-1">
        {/* Bandeau mode placement */}
        {placementMode && (
          <div className="absolute left-1/2 top-4 z-[999] -translate-x-1/2 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-700 shadow-md">
            <MapPin className="mr-1.5 inline h-3.5 w-3.5" />
            Mode placement actif — cliquez sur la carte pour positionner{" "}
            {selected ? <strong>{selected.nom}</strong> : "le lotissement sélectionné"}
          </div>
        )}

        {/* Aide si aucun lotissement positionné */}
        {!loading && withCoords === 0 && !placementMode && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center bg-slate-50/80 backdrop-blur-sm">
            <div className="max-w-xs rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-lg">
              <Building2 className="mx-auto mb-3 h-8 w-8 text-slate-300" />
              <p className="font-semibold text-slate-700">Aucun lotissement positionné</p>
              <p className="mt-1 text-sm text-slate-400">
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
    </div>
  );
}
