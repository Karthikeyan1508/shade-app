"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { TIER_COLORS, RiskTier } from "@/lib/risk-engine";

export interface SiteMarker {
  id: string;
  name: string;
  lat: number;
  lng: number;
  latest_tier: RiskTier | null;
  latest_value: number | null;
}

export default function MapView({ sites }: { sites: SiteMarker[] }) {
  const center: [number, number] =
    sites.length > 0 ? [sites[0].lat, sites[0].lng] : [25.0, 55.0];

  return (
    <MapContainer center={center} zoom={7} style={{ height: "480px", width: "100%", borderRadius: "12px" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {sites.map((site) => (
        <CircleMarker
          key={site.id}
          center={[site.lat, site.lng]}
          radius={12}
          pathOptions={{
            color: "#FFFFFF",
            weight: 2,
            fillColor: TIER_COLORS[site.latest_tier ?? "Safe"],
            fillOpacity: 0.9,
          }}
        >
          <Popup>
            <strong>{site.name}</strong>
            <br />
            Tier: {site.latest_tier ?? "no data yet"}
            <br />
            Value: {site.latest_value ?? "—"}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
