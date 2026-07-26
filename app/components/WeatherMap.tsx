"use client";

import { useEffect, useRef } from "react";
import type { Location } from "../types";

type WeatherMapProps = {
  locations: Location[];
  temperatures?: Record<string, string>;
};

export function WeatherMap({ locations, temperatures = {} }: WeatherMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || locations.length === 0) return;
    let cancelled = false;
    let map: import("maplibre-gl").Map | undefined;

    void import("maplibre-gl").then((maplibregl) => {
      if (cancelled || !containerRef.current) return;
      const center = locations[0];
      map = new maplibregl.Map({
        container: containerRef.current,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [center.longitude, center.latitude],
        zoom: locations.length > 1 ? 1.5 : 8,
        attributionControl: false,
      });
      map.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        "bottom-right",
      );
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "top-right",
      );

      const bounds = new maplibregl.LngLatBounds();
      locations.forEach((location) => {
        const marker = document.createElement("button");
        marker.className = "map-weather-marker";
        marker.type = "button";
        marker.setAttribute(
          "aria-label",
          `${location.name}, ${temperatures[location.id] ?? "weather destination"}`,
        );
        marker.textContent = temperatures[location.id] ?? "•";

        const popup = new maplibregl.Popup({ offset: 24 }).setText(
          `${location.name}${temperatures[location.id] ? ` · ${temperatures[location.id]}` : ""}`,
        );
        new maplibregl.Marker({ element: marker })
          .setLngLat([location.longitude, location.latitude])
          .setPopup(popup)
          .addTo(map!);
        bounds.extend([location.longitude, location.latitude]);
      });

      if (locations.length > 1) {
        map.fitBounds(bounds, { padding: 70, maxZoom: 5, duration: 0 });
      }
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [locations, temperatures]);

  return (
    <div
      ref={containerRef}
      className="weather-map"
      aria-label="Interactive destination map"
    />
  );
}

