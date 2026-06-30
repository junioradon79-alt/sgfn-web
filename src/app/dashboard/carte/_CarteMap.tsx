"use client";

// Ce fichier est importé dynamiquement (ssr: false) — il peut utiliser Leaflet librement.
import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ─── Icônes SVG custom (évite les problèmes webpack avec les images Leaflet) ──

function makePin(fill: string, border = "white") {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 38" width="28" height="38">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 24 14 24S28 24.5 28 14C28 6.268 21.732 0 14 0z"
      fill="${fill}" stroke="${border}" stroke-width="2"/>
    <circle cx="14" cy="14" r="6" fill="white" opacity="0.9"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [28, 38],
    iconAnchor: [14, 38],
    popupAnchor: [0, -40],
  });
}

const PIN_BLEU   = makePin("#0D3B66");
const PIN_GRIS   = makePin("#94a3b8");
const PIN_CURSOR = makePin("#1E6091", "#facc15");

export type LotissementGeo = {
  id: string;
  nom: string;
  village: string | null;
  commune: string | null;
  nb_lots: number | null;
  nb_ilots: number | null;
  superficie_texte: string | null;
  latitude: number | null;
  longitude: number | null;
};

// ─── Gestionnaire de clic carte (mode placement) ─────────────────────────────

function ClickHandler({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick?.(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function CarteMap({
  lotissements,
  selectedId,
  placementMode,
  onLotissementClick,
  onMapClick,
}: {
  lotissements: LotissementGeo[];
  selectedId: string | null;
  placementMode: boolean;
  onLotissementClick: (id: string) => void;
  onMapClick?: (lat: number, lng: number) => void;
}) {
  const mapRef = useRef<L.Map | null>(null);

  // Centrer sur le lotissement sélectionné s'il a des coordonnées
  useEffect(() => {
    if (!mapRef.current || !selectedId) return;
    const lot = lotissements.find((l) => l.id === selectedId);
    if (lot?.latitude && lot?.longitude) {
      mapRef.current.flyTo([lot.latitude, lot.longitude], 15, { duration: 1.2 });
    }
  }, [selectedId, lotissements]);

  const avecCoords = lotissements.filter((l) => l.latitude && l.longitude);

  // Centre initial : Anyama / Ebimpé ou le 1er lotissement avec coordonnées
  const defaultCenter: [number, number] =
    avecCoords.length > 0
      ? [avecCoords[0].latitude!, avecCoords[0].longitude!]
      : [5.4834, -4.0247]; // Ebimpé fallback

  return (
    <MapContainer
      center={defaultCenter}
      zoom={avecCoords.length > 0 ? 14 : 11}
      className="h-full w-full"
      style={{ cursor: placementMode ? "crosshair" : "grab" }}
      ref={mapRef}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {placementMode && <ClickHandler onMapClick={onMapClick} />}

      {avecCoords.map((lot) => {
        const isSelected = lot.id === selectedId;
        const icon = placementMode && isSelected ? PIN_CURSOR : PIN_BLEU;
        return (
          <Marker
            key={lot.id}
            position={[lot.latitude!, lot.longitude!]}
            icon={icon}
            eventHandlers={{ click: () => onLotissementClick(lot.id) }}
          >
            <Popup className="sgfn-popup">
              <div className="min-w-[180px]">
                <p className="font-bold text-[#0D3B66]">{lot.nom}</p>
                {lot.village && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    Village : {lot.village}{lot.commune ? ` · ${lot.commune}` : ""}
                  </p>
                )}
                <div className="mt-2 flex gap-3 text-sm">
                  {lot.nb_ilots && (
                    <span className="text-slate-600"><strong>{lot.nb_ilots}</strong> îlots</span>
                  )}
                  {lot.nb_lots && (
                    <span className="text-slate-600"><strong>{lot.nb_lots}</strong> lots</span>
                  )}
                </div>
                {lot.superficie_texte && (
                  <p className="mt-1 text-xs text-slate-400">{lot.superficie_texte}</p>
                )}
                <p className="mt-2 text-xs text-slate-400">
                  {lot.latitude?.toFixed(5)}, {lot.longitude?.toFixed(5)}
                </p>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
