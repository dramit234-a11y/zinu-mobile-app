import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DemoBanner } from '../../components/DemoBanner';
import { NotificationBell } from '../../components/NotificationBell';
import { ZinuMap } from '../../components/map/ZinuMap';
import { DEFAULT_CENTER } from '../../components/map/types';
import { Txt, type IconName } from '../../components/ui';
import { api } from '../../lib/api';
import { currentPosition, shouldExplainLocation } from '../../lib/location';
import { ringToLatLng, useRide } from '../../lib/ride';
import { colors, radius, spacing } from '../../lib/theme';

const SERVICES: { key: 'bike' | 'toto' | 'auto' | 'cab' | 'shared' | 'schedule'; code: string | null; icon: IconName }[] = [
  { key: 'bike', code: 'BIKE', icon: 'bicycle' },
  { key: 'toto', code: 'TOTO', icon: 'flash' },
  { key: 'auto', code: 'AUTO', icon: 'car' },
  { key: 'cab', code: 'CAB', icon: 'car-sport' },
  { key: 'shared', code: 'SHARED', icon: 'people' },
  { key: 'schedule', code: null, icon: 'calendar' },
];

/** Spec §10: map-based home with current location, "Where to?", quick places and ride types. */
export default function PassengerHome() {
  const { t } = useTranslation();
  const ride = useRide();
  const [locating, setLocating] = useState(true);

  const locate = useCallback(async () => {
    setLocating(true);
    const here = await currentPosition();
    useRide.getState().setHere(here);
    if (here) {
      const { place } = await api.reverseGeocode(here).catch(() => ({ place: null }));
      if (place) useRide.getState().setPickup(place);
    }
    setLocating(false);
  }, []);

  useEffect(() => {
    (async () => {
      if (await shouldExplainLocation()) router.push('/location-permission');
      else locate();
    })();
  }, [locate]);
  // Returning from the permission screen: try again.
  useFocusEffect(
    useCallback(() => {
      if (!useRide.getState().here) locate();
    }, [locate]),
  );

  const center = ride.here ?? DEFAULT_CENTER;
  const area = useQuery({ queryKey: ['service-area', center.lat.toFixed(3), center.lng.toFixed(3)], queryFn: () => api.serviceArea(center) });
  const cityId = area.data?.city?.id;
  const zones = useQuery({ queryKey: ['zones', cityId], queryFn: () => api.serviceZones(cityId!), enabled: !!cityId });
  const saved = useQuery({ queryKey: ['saved-places'], queryFn: api.savedPlaces });

  const goSearch = (category: string | null = null) => {
    useRide.getState().setPreferredCategory(category);
    router.push('/ride/search');
  };
  const goSaved = (label: 'HOME' | 'WORK') => {
    const p = saved.data?.find((s) => s.label === label);
    if (!p) return router.push({ pathname: '/ride/search', params: { mode: 'save', label } });
    useRide.getState().setDropoff(p);
    router.push(ride.pickup ? '/ride/options' : '/ride/search');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.mapArea}>
        <ZinuMap
          center={center}
          follow
          showsUserLocation={!!ride.here}
          markers={ride.pickup ? [{ id: 'pickup', at: ride.pickup, kind: 'pickup' }] : []}
          zones={(zones.data ?? []).map((z) => ringToLatLng(z.boundary.coordinates))}
          accessibilityLabel={t('passenger.currentLocation')}
        />
        <SafeAreaView edges={['top']} style={styles.topBar} pointerEvents="box-none">
          <View style={styles.topRow}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('passenger.tabs.profile')} onPress={() => router.push('/passenger/profile')} style={styles.round}>
              <Ionicons name="person" size={22} color={colors.text} />
            </Pressable>
            <View style={styles.round}>
              <NotificationBell />
            </View>
          </View>
        </SafeAreaView>
        <Pressable accessibilityRole="button" accessibilityLabel={t('ride.useCurrent')} onPress={locate} style={[styles.round, styles.locate]}>
          <Ionicons name="locate" size={22} color={colors.primary} />
        </Pressable>
      </View>

      <ScrollView style={styles.sheet} contentContainerStyle={{ padding: spacing.xl, paddingTop: spacing.lg }}>
        <DemoBanner />
        <Txt variant="caption" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
          {t('passenger.currentLocation')}
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="location" size={18} color={colors.primary} />
          <Txt variant="bodyStrong" numberOfLines={1} style={{ marginLeft: 4, flex: 1 }}>
            {locating ? t('ride.locating') : (ride.pickup?.address ?? t('ride.locDenied'))}
          </Txt>
        </View>
        {area.data && !area.data.inService && ride.here ? (
          <Txt color={colors.danger} style={{ marginTop: spacing.xs }}>
            {t('ride.outsideArea')}
          </Txt>
        ) : null}

        <Pressable accessibilityRole="search" accessibilityLabel={t('passenger.whereTo')} onPress={() => goSearch()} style={styles.search}>
          <Ionicons name="search" size={22} color={colors.primary} />
          <Txt variant="heading" color={colors.textMuted} style={{ marginLeft: spacing.md }}>
            {t('passenger.whereTo')}
          </Txt>
        </Pressable>

        <View style={styles.quickRow}>
          <Quick icon="home" label={t('passenger.quick.home')} onPress={() => goSaved('HOME')} />
          <Quick icon="briefcase" label={t('passenger.quick.work')} onPress={() => goSaved('WORK')} />
          <Quick icon="time" label={t('passenger.quick.recent')} onPress={() => goSearch()} />
          <Quick icon="bookmark" label={t('passenger.quick.saved')} onPress={() => router.push('/settings/places')} />
        </View>

        <Txt variant="heading" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
          {t('passenger.services')}
        </Txt>
        <View style={styles.grid}>
          {SERVICES.map((s) => (
            <Pressable
              key={s.key}
              accessibilityRole="button"
              accessibilityLabel={t(`passenger.service.${s.key}`)}
              onPress={() => (s.code ? goSearch(s.code) : router.push('/ride/search'))}
              style={styles.service}
            >
              <Ionicons name={s.icon} size={28} color={colors.primary} />
              <Txt variant="bodyStrong" style={{ marginTop: spacing.xs }}>
                {t(`passenger.service.${s.key}`)}
              </Txt>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function Quick({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.quick}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Txt variant="caption" style={{ marginLeft: 6, fontWeight: '600' }}>
        {label}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mapArea: { height: '42%', backgroundColor: colors.surface },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  round: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', elevation: 3, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  locate: { position: 'absolute', right: spacing.lg, bottom: spacing.xl },
  sheet: { flex: 1, marginTop: -16, backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  search: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: spacing.lg, minHeight: 58, marginTop: spacing.lg, borderWidth: 1.5, borderColor: colors.border },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  quick: { flexDirection: 'row', alignItems: 'center', minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.md },
  service: { width: '31%', paddingVertical: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
});
