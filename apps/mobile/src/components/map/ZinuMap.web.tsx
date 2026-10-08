import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../../lib/theme';
import type { ZinuMapProps } from './types';

/**
 * Browser preview only (Expo web): Leaflet with OpenStreetMap tiles so screens can be checked in a browser.
 * The Android/iOS apps use Google / Apple maps via ZinuMap.tsx.
 */
export function ZinuMap({ center, follow, markers = [], route, zones = [], fitTo, onCenterChange, accessibilityLabel }: ZinuMapProps) {
  const host = useRef<View>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const onMove = useRef(onCenterChange);
  onMove.current = onCenterChange;

  useEffect(() => {
    const el = host.current as unknown as HTMLElement;
    const m = L.map(el, { zoomControl: false, attributionControl: true }).setView([center.lat, center.lng], 14);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(m);
    m.on('moveend', () => {
      const c = m.getCenter();
      onMove.current?.({ lat: c.lat, lng: c.lng });
    });
    map.current = m;
    layer.current = L.layerGroup().addTo(m);
    return () => {
      m.remove();
      map.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (follow) map.current?.setView([center.lat, center.lng], map.current.getZoom());
  }, [follow, center.lat, center.lng]);

  const key = JSON.stringify([markers, route?.length, zones.length]);
  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    for (const z of zones) L.polygon(z.map((p) => [p.lat, p.lng] as [number, number]), { color: colors.primary, weight: 2, fillOpacity: 0.05 }).addTo(g);
    if (route && route.length > 1) L.polyline(route.map((p) => [p.lat, p.lng] as [number, number]), { color: colors.primaryDark, weight: 5 }).addTo(g);
    for (const m of markers)
      L.circleMarker([m.at.lat, m.at.lng], { radius: 8, color: '#fff', weight: 3, fillColor: m.kind === 'pickup' ? colors.primary : colors.text, fillOpacity: 1 }).addTo(g);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const fitKey = fitTo?.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|');
  useEffect(() => {
    if (fitTo && fitTo.length > 1) map.current?.fitBounds(L.latLngBounds(fitTo.map((p) => [p.lat, p.lng] as [number, number])), { padding: [40, 40] });
  }, [fitKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return <View ref={host} style={StyleSheet.absoluteFill} accessibilityLabel={accessibilityLabel} />;
}
