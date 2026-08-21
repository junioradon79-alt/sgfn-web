"use client";

// Importé dynamiquement (ssr:false) — peut utiliser Leaflet librement.
// Carte floutée : cercle de 500 m sur des coordonnées déjà arrondies côté
// serveur (lat_approx/lng_approx, ~110 m). L'emplacement exact n'est jamais
// transmis au navigateur — même pattern que AnnonceMap.tsx (monterrain-web)
// et _VenteMap.tsx en mode "preview".
import { MapContainer, TileLayer, Circle } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export default function PasseportMap({ point }: { point: [number, number] }) {
  return (
    <MapContainer
      center={point}
      zoom={13}
      className="h-full w-full z-0"
      style={{ cursor: "grab" }}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={18}
      />
      <Circle
        center={point}
        radius={500}
        pathOptions={{ color: "#b45309", weight: 1.5, fillColor: "#d97706", fillOpacity: 0.18 }}
      />
    </MapContainer>
  );
}
