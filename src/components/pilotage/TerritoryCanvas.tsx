"use client";

// Importé dynamiquement (ssr: false) : Leaflet touche `window` au chargement et
// l'application est exportée en statique.
import { useEffect, useMemo, useRef } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip as LTooltip, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import type { LotGeo, Perimetre } from "@/hooks/useAdminOverview";

export type FondCarte = "plan" | "satellite";

const FONDS: Record<FondCarte, { url: string; attribution: string }> = {
  plan: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Imagerie &copy; Esri, Maxar, Earthstar Geographics",
  },
};

/** Teinte d'un périmètre selon son taux d'occupation — même échelle que les KPI. */
function teinte(taux: number) {
  if (taux >= 90) return "#0b2e4f";
  if (taux >= 70) return "#0f5e8c";
  if (taux >= 40) return "#4f9ec4";
  return "#94a3b8";
}

/**
 * Groupe les périmètres qui partagent le même point de référence.
 *
 * Ce n'est pas un cas théorique : les deux lotissements réels sont enregistrés
 * sur des coordonnées identiques (le point du village d'Ebimpé). Superposer
 * deux marqueurs les rendrait tous deux incliquables ; les décaler
 * inventerait une position. On affiche donc un marqueur par *lieu*, et le
 * volet latéral liste les périmètres qui s'y trouvent.
 */
export type Amas = {
  cle: string;
  latitude: number;
  longitude: number;
  perimetres: Perimetre[];
  lots: number;
  occupes: number;
  taux: number;
};

export function grouperParLieu(perimetres: Perimetre[]): Amas[] {
  const parLieu = new Map<string, Perimetre[]>();
  for (const p of perimetres) {
    if (p.latitude == null || p.longitude == null) continue;
    const cle = `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`;
    parLieu.set(cle, [...(parLieu.get(cle) ?? []), p]);
  }
  return [...parLieu.entries()].map(([cle, ps]) => {
    const lots = ps.reduce((s, p) => s + p.lots, 0);
    const occupes = ps.reduce((s, p) => s + p.occupes, 0);
    return {
      cle,
      latitude: ps[0].latitude!,
      longitude: ps[0].longitude!,
      perimetres: ps,
      lots,
      occupes,
      taux: lots > 0 ? Math.round((occupes / lots) * 100) : 0,
    };
  });
}

/** Recadre sur l'ensemble des points au montage, puis suit la sélection. */
function Cadrage({ amas, selection }: { amas: Amas[]; selection: Perimetre | null }) {
  const map = useMap();
  const cadre = useRef(false);

  useEffect(() => {
    if (cadre.current || amas.length === 0) return;
    cadre.current = true;

    if (amas.length === 1) {
      map.setView([amas[0].latitude, amas[0].longitude], 14);
      return;
    }
    map.fitBounds(L.latLngBounds(amas.map((a) => [a.latitude, a.longitude] as [number, number])), {
      padding: [56, 56],
      maxZoom: 15,
    });
  }, [amas, map]);

  useEffect(() => {
    if (!selection?.latitude || !selection.longitude) return;
    map.flyTo([selection.latitude, selection.longitude], Math.max(map.getZoom(), 15), { duration: 0.9 });
  }, [selection, map]);

  return null;
}

export default function TerritoryCanvas({
  perimetres,
  lotsGeo,
  selection,
  onSelect,
  fond,
  afficherLots,
}: {
  perimetres: Perimetre[];
  lotsGeo: LotGeo[];
  selection: Perimetre | null;
  onSelect: (p: Perimetre) => void;
  fond: FondCarte;
  afficherLots: boolean;
}) {
  const amas = useMemo(() => grouperParLieu(perimetres), [perimetres]);
  const centre: [number, number] = amas.length > 0 ? [amas[0].latitude, amas[0].longitude] : [7.54, -5.55]; // Côte d'Ivoire

  return (
    <MapContainer
      center={centre}
      zoom={amas.length > 0 ? 13 : 7}
      className="size-full"
      scrollWheelZoom
      // Le fond est déjà résumé par les KPI : la carte sert à situer, pas à
      // remplacer le tableau — on garde donc les contrôles au minimum.
      attributionControl
    >
      <TileLayer key={fond} url={FONDS[fond].url} attribution={FONDS[fond].attribution} maxZoom={19} />

      <Cadrage amas={amas} selection={selection} />

      {/* Lots géolocalisés — un point par lot réellement positionné. */}
      {afficherLots &&
        lotsGeo.map((lot) => (
          <CircleMarker
            key={lot.id}
            center={[lot.latitude, lot.longitude]}
            radius={4}
            pathOptions={{ color: "#ffffff", weight: 1.5, fillColor: "#147a55", fillOpacity: 0.95 }}
          >
            <LTooltip direction="top" offset={[0, -6]}>
              Lot {lot.numero ?? "—"} · {lot.statut ?? "statut inconnu"}
            </LTooltip>
          </CircleMarker>
        ))}

      {/* Périmètres — rayon proportionnel au nombre de lots (√, pour que l'aire
          du disque reste proportionnelle à la quantité, pas son rayon). */}
      {amas.map((a) => {
        const actif = selection != null && a.perimetres.some((p) => p.id === selection.id);
        const r = Math.min(34, Math.max(11, Math.sqrt(a.lots) * 0.85));
        return (
          <CircleMarker
            key={a.cle}
            center={[a.latitude, a.longitude]}
            radius={r}
            pathOptions={{
              color: actif ? "#ffffff" : teinte(a.taux),
              weight: actif ? 3 : 1.5,
              fillColor: teinte(a.taux),
              fillOpacity: 0.55,
            }}
            eventHandlers={{ click: () => onSelect(a.perimetres[0]) }}
          >
            <LTooltip direction="top" offset={[0, -r]} opacity={1}>
              <span className="font-semibold">
                {a.perimetres.length > 1 ? `${a.perimetres.length} périmètres` : a.perimetres[0].nom}
              </span>
              {" — "}
              {a.lots.toLocaleString("fr-FR")} lots · {a.taux}% occupés
            </LTooltip>

            <Popup>
              <div className="min-w-[190px]">
                <p className="text-[11px] font-bold tracking-wide text-slate-400 uppercase">
                  {a.perimetres[0].commune ?? "Commune inconnue"}
                  {a.perimetres[0].village ? ` · ${a.perimetres[0].village}` : ""}
                </p>
                <ul className="mt-1.5 space-y-1.5">
                  {a.perimetres.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(p)}
                        className="w-full text-left font-semibold text-[#0B2E4F] hover:underline"
                      >
                        {p.nom}
                      </button>
                      <span className="block text-xs text-slate-500">
                        {p.lots.toLocaleString("fr-FR")} lots · {p.tauxOccupation}% occupés · {p.libres} libres
                      </span>
                    </li>
                  ))}
                </ul>
                {a.perimetres.length > 1 && (
                  <p className="mt-2 border-t border-slate-100 pt-1.5 text-[11px] text-slate-400">
                    Ces périmètres partagent le même point de référence en base.
                  </p>
                )}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
