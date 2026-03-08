"use client";

import { useEffect, useRef, memo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MapViewProps {
    pickup?: { lat: number; lng: number; label?: string };
    dropoff?: { lat: number; lng: number; label?: string };
    height?: string;
}

// Optimized: Memoize component to prevent unnecessary re-renders
function MapView({ pickup, dropoff, height = "300px" }: MapViewProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<L.Map | null>(null);

    useEffect(() => {
        if (!mapRef.current || mapInstance.current) return;

        const center = pickup
            ? [pickup.lat, pickup.lng]
            : dropoff
              ? [dropoff.lat, dropoff.lng]
              : [20.5937, 78.9629]; // Default: India center

        const map = L.map(mapRef.current).setView(center as [number, number], 7);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "&copy; OpenStreetMap contributors",
        }).addTo(map);

        const defaultIcon = L.icon({
            iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
            iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
            shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
        });

        if (pickup) {
            L.marker([pickup.lat, pickup.lng], { icon: defaultIcon })
                .addTo(map)
                .bindPopup(pickup.label || "Pickup");
        }

        if (dropoff) {
            L.marker([dropoff.lat, dropoff.lng], { icon: defaultIcon })
                .addTo(map)
                .bindPopup(dropoff.label || "Dropoff");
        }

        if (pickup && dropoff) {
            const line = L.polyline(
                [[pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]],
                { color: "#000", weight: 2, dashArray: "6 4" }
            ).addTo(map);
            map.fitBounds(line.getBounds().pad(0.3));
        }

        mapInstance.current = map;

        return () => {
            map.remove();
            mapInstance.current = null;
        };
    }, [pickup, dropoff]);

    return (
        <div
            ref={mapRef}
            style={{ height, width: "100%" }}
            className="rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-700"
        />
    );
}

// Optimized: Export memoized version
export default memo(MapView);
