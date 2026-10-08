import Constants from 'expo-constants';
import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Polygon, Polyline } from 'react-native-maps';
import { colors } from '../../lib/theme';
import type { ZinuMapProps } from './types';

const toNative = (p: { lat: number; lng: number }) => ({ latitude: p.lat, longitude: p.lng });

// Android always uses Google Maps. iOS uses Google only when the build includes an iOS key, otherwise Apple Maps.
const provider = Platform.OS === 'android' || Constants.expoConfig?.extra?.iosGoogleMaps ? PROVIDER_GOOGLE : undefined;

/** Native map (react-native-maps). Screens use only this component, so the map SDK can be swapped. */
export function ZinuMap({ center, follow, markers = [], route, zones = [], showsUserLocation, fitTo, onCenterChange, accessibilityLabel }: ZinuMapProps) {
  const ref = useRef<MapView>(null);

  useEffect(() => {
    if (follow) ref.current?.animateToRegion({ ...toNative(center), latitudeDelta: 0.02, longitudeDelta: 0.02 }, 400);
  }, [follow, center.lat, center.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const fitKey = fitTo?.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|');
  useEffect(() => {
    if (fitTo && fitTo.length > 1) ref.current?.fitToCoordinates(fitTo.map(toNative), { edgePadding: { top: 60, right: 50, bottom: 60, left: 50 }, animated: true });
  }, [fitKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <MapView
      ref={ref}
      style={StyleSheet.absoluteFill}
      provider={provider}
      initialRegion={{ ...toNative(center), latitudeDelta: 0.03, longitudeDelta: 0.03 }}
      showsUserLocation={showsUserLocation}
      showsMyLocationButton={false}
      toolbarEnabled={false}
      accessibilityLabel={accessibilityLabel}
      onRegionChangeComplete={(r) => onCenterChange?.({ lat: r.latitude, lng: r.longitude })}
    >
      {zones.map((z, i) => (
        <Polygon key={i} coordinates={z.map(toNative)} strokeColor={colors.primary} strokeWidth={2} fillColor="rgba(14,122,85,0.06)" />
      ))}
      {route && route.length > 1 && <Polyline coordinates={route.map(toNative)} strokeColor={colors.primaryDark} strokeWidth={5} />}
      {markers.map((m) => (
        <Marker key={m.id} coordinate={toNative(m.at)} anchor={{ x: 0.5, y: 0.5 }} accessibilityLabel={m.kind}>
          <View style={m.kind === 'pickup' ? styles.pickup : styles.dropoff} />
        </Marker>
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  pickup: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.primary, borderWidth: 3, borderColor: '#fff' },
  dropoff: { width: 18, height: 18, borderRadius: 3, backgroundColor: colors.text, borderWidth: 3, borderColor: '#fff' },
});
