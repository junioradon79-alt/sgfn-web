"use client";

// Importé dynamiquement (ssr: false) — Leaflet a besoin des APIs browser.
import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Dans un modal, la carte s'initialise avant que son conteneur ait sa taille finale :
// sans invalidateSize(), les tuiles ne se chargent pas (fond gris).
function SizeFix() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

function makePin(fill: string, border = "white") {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 38" width="28" height="38">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 24 14 24S28 24.5 28 14C28 6.268 21.732 0 14 0z"
      fill="${fill}" stroke="${border}" stroke-width="2"/>
    <circle cx="14" cy="14" r="6" fill="white" opacity="0.9"/>
  </svg>`;
  return L.divIcon({ html: svg, className: "", iconSize: [28, 38], iconAnchor: [14, 38], popupAnchor: [0, -40] });
}

const PIN = makePin("#0D3B66");

export default function LotDetailMap({
  lat,
  lng,
  label,
  approx,
}: {
  lat: number;
  lng: number;
  label: string;
  approx?: boolean;
}) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={15}
      scrollWheelZoom={false}
      className="h-full w-full"
      attributionControl={false}
    >
      <SizeFix />
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker position={[lat, lng]} icon={PIN}>
        <Popup className="sgnf-popup">
          <p className="font-bold text-[#0D3B66]">{label}</p>
          {approx && <p className="mt-0.5 text-xs text-slate-500">Localisation approximative (niveau lotissement)</p>}
        </Popup>
      </Marker>
    </MapContainer>
  );
}
