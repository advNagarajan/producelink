"use client";

import { useEffect, useRef, memo } from "react";
import "leaflet/dist/leaflet.css";

interface MapViewProps {
    pickup?: { lat: number; lng: number; label?: string };
    dropoff?: { lat: number; lng: number; label?: string };
    routePath?: Array<{ lat: number; lng: number }>;
    checkpoints?: Array<{ lat: number; lng: number; label?: string }>;
    height?: string;
}

// Optimized: Memoize component to prevent unnecessary re-renders
function MapView({ pickup, dropoff, routePath, checkpoints, height = "300px" }: MapViewProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<any>(null);

    useEffect(() => {
        if (!mapRef.current) return;

        if (mapInstance.current) {
            mapInstance.current.remove();
            mapInstance.current = null;
        }

        let disposed = false;

        const initMap = async () => {
            const leaflet = await import("leaflet");
            const L = leaflet.default;

            if (!mapRef.current || disposed) return;

            const center = pickup
                ? [pickup.lat, pickup.lng]
                : dropoff
                  ? [dropoff.lat, dropoff.lng]
                  : [20.5937, 78.9629];

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

            if (checkpoints?.length) {
                checkpoints.forEach((point, idx) => {
                    L.circleMarker([point.lat, point.lng], {
                        radius: 5,
                        color: "#111",
                        fillColor: "#111",
                        fillOpacity: 0.8,
                        weight: 1,
                    })
                        .addTo(map)
                        .bindPopup(point.label || `Checkpoint ${idx + 1}`);
                });
            }

            const routeCoordinates: [number, number][] = routePath?.length
                ? routePath.map((p) => [p.lat, p.lng] as [number, number])
                : pickup && dropoff
                  ? [[pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]]
                  : [];

            if (routeCoordinates.length >= 2) {
                const line = L.polyline(routeCoordinates, {
                    color: "#000",
                    weight: 3,
                    opacity: 0.85,
                }).addTo(map);
                map.fitBounds(line.getBounds().pad(0.25));
            }

            mapInstance.current = map;
        };

        initMap();

        return () => {
            disposed = true;
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, [pickup, dropoff, routePath, checkpoints]);

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
