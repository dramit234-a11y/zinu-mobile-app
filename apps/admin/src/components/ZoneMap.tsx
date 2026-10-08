'use client';

import 'leaflet/dist/leaflet.css';
import type * as Leaflet from 'leaflet';
import { useEffect, useRef } from 'react';

type Ring = [number, number][]; // [lng, lat] like GeoJSON

/**
 * On-map zone editor (Leaflet + OpenStreetMap tiles, no API key needed).
 * Shows existing zones; while drawing, each click adds a corner to the new zone.
 */
export function ZoneMap(props: {
  center: { lat: number; lng: number };
  zones: { id: string; name: string; active: boolean; ring: Ring }[];
  drawing: Ring;
  drawingEnabled: boolean;
  onAddPoint: (p: [number, number]) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const zonesLayer = useRef<Leaflet.LayerGroup | null>(null);
  const drawLayer = useRef<Leaflet.LayerGroup | null>(null);
  const L = useRef<typeof Leaflet | null>(null);
  const handlers = useRef(props);
  handlers.current = props;

  useEffect(() => {
    let cancelled = false;
    import('leaflet').then((mod) => {
      if (cancelled || !el.current) return;
      const lib = (mod as unknown as { default?: typeof Leaflet }).default ?? (mod as unknown as typeof Leaflet);
      L.current = lib;
      const m = lib.map(el.current).setView([props.center.lat, props.center.lng], 12);
      lib.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(m);
      m.on('click', (e: Leaflet.LeafletMouseEvent) => {
        if (handlers.current.drawingEnabled) handlers.current.onAddPoint([Number(e.latlng.lng.toFixed(6)), Number(e.latlng.lat.toFixed(6))]);
      });
      zonesLayer.current = lib.layerGroup().addTo(m);
      drawLayer.current = lib.layerGroup().addTo(m);
      map.current = m;
      render();
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const render = () => {
    const lib = L.current;
    if (!lib || !zonesLayer.current || !drawLayer.current) return;
    zonesLayer.current.clearLayers();
    for (const z of handlers.current.zones) {
      lib
        .polygon(z.ring.map(([lng, lat]) => [lat, lng] as [number, number]), { color: z.active ? '#0e7a55' : '#8a9a94', weight: 2, fillOpacity: 0.08, dashArray: z.active ? undefined : '6 6' })
        .bindTooltip(z.name)
        .addTo(zonesLayer.current);
    }
    drawLayer.current.clearLayers();
    const pts = handlers.current.drawing.map(([lng, lat]) => [lat, lng] as [number, number]);
    if (pts.length > 1) lib.polygon(pts, { color: '#f5b700', weight: 3, fillOpacity: 0.15 }).addTo(drawLayer.current);
    for (const p of pts) lib.circleMarker(p, { radius: 5, color: '#10231c', fillColor: '#f5b700', fillOpacity: 1, weight: 2 }).addTo(drawLayer.current);
  };

  useEffect(render, [props.zones, props.drawing]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={el}
      role="application"
      aria-label="Zone map. Click to add corners of a new zone while drawing."
      style={{ height: 420, borderRadius: 12, border: '1px solid var(--border)', cursor: props.drawingEnabled ? 'crosshair' : 'grab' }}
    />
  );
}
