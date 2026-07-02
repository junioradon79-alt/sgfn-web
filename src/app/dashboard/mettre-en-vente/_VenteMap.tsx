"use client";

// Importé dynamiquement (ssr:false) — peut utiliser Leaflet librement.
import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function makePin(fill: string, border = "white") {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 38" width="28" height="38">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 24 14 24S28 24.5 28 14C28 6.268 21.732 0 14 0z"
      fill="${fill}" stroke="${border}" stroke-width="2"/>
    <circle cx="14" cy="14" r="6" fill="white" opacity="0.9"/>
  </svg>`;
  return L.divIcon({ html: svg, className: "", iconSize: [28, 38], iconAnchor: [14, 38] });
}
const PIN = makePin("#0D3B66", "#facc15");

// Centre par défaut : Grand Abidjan
const DEFAULT_CENTER: [number, number] = [5.3599, -4.0083];

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

// Recentre la carte quand le point change (ex. sélection d'un autre lot)
function Recenter({ point }: { point: [number, number] | null }) {
  const map = useMapEvents({});
  const last = useRef<string>("");
  useEffect(() => {
    if (!point) return;
    const key = point.join(",");
    if (key !== last.current) {
      last.current = key;
      map.flyTo(point, Math.max(map.getZoom(), 14), { duration: 0.8 });
    }
  }, [point, map]);
  return null;
}

export default function VenteMap({
  mode,
  point,
  onPick,
}: {
  mode: "exact" | "preview";
  point: [number, number] | null;
  onPick?: (lat: number, lng: number) => void;
}) {
  const center = point ?? DEFAULT_CENTER;
  return (
    <MapContainer
      center={center}
      zoom={point ? 14 : 11}
      className="h-full w-full"
      style={{ cursor: mode === "exact" ? "crosshair" : "grab" }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={18}
      />
      <Recenter point={point} />

      {mode === "exact" && onPick && <ClickHandler onPick={onPick} />}

      {mode === "exact" && point && (
        <Marker
          position={point}
          icon={PIN}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const ll = (e.target as L.Marker).getLatLng();
              onPick?.(ll.lat, ll.lng);
            },
          }}
        />
      )}

      {mode === "preview" && point && (
        <Circle
          center={point}
          radius={500}
          pathOptions={{ color: "#b45309", weight: 1.5, fillColor: "#d97706", fillOpacity: 0.18 }}
        />
      )}
    </MapContainer>
  );
}
