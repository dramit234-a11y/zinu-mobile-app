import Ionicons from '@expo/vector-icons/Ionicons';
import type { PlaceDto } from '@zinu/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DemoBanner } from '../../components/DemoBanner';
import { ZinuMap } from '../../components/map/ZinuMap';
import { DEFAULT_CENTER, type LatLng } from '../../components/map/types';
import { Button, Txt, notify } from '../../components/ui';
import { errorMessage } from '../../i18n';
import { api } from '../../lib/api';
import { useRide } from '../../lib/ride';
import { colors, spacing } from '../../lib/theme';

/** Spec §11 "Choose on Map": move the map under a fixed pin; the address under the pin is looked up. */
export default function PickOnMap() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { field, label } = useLocalSearchParams<{ field: 'pickup' | 'dropoff' | 'save'; label?: string }>();
  const ride = useRide();
  const start = (field === 'pickup' ? ride.pickup : field === 'dropoff' ? ride.dropoff : null) ?? ride.here ?? ride.pickup ?? DEFAULT_CENTER;
  const [center, setCenter] = useState<LatLng>(start);
  const [place, setPlace] = useState<PlaceDto | null>(null);
  const [inService, setInService] = useState(true);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);

  useEffect(() => {
    const n = ++seq.current;
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const [rev, area] = await Promise.all([api.reverseGeocode(center), api.serviceArea(center)]);
        if (n !== seq.current) return; // a newer pan superseded this lookup
        setPlace(rev.place);
        setInService(area.inService);
      } catch (e) {
        if (n === seq.current) notify(errorMessage(e));
      } finally {
        if (n === seq.current) setLoading(false);
      }
    }, 450);
    return () => clearTimeout(id);
  }, [center.lat, center.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirm = async () => {
    if (!place) return;
    if (field === 'save') {
      try {
        await api.savePlace({ ...place, label: (label as 'HOME' | 'WORK' | 'OTHER') || 'OTHER' });
        await qc.invalidateQueries({ queryKey: ['saved-places'] });
        router.dismissTo('/settings/places');
      } catch (e) {
        notify(errorMessage(e));
      }
      return;
    }
    const s = useRide.getState();
    if (field === 'pickup') s.setPickup(place);
    else s.setDropoff(place);
    const next = useRide.getState();
    if (next.pickup && next.dropoff) router.replace('/ride/options');
    else router.back();
  };

  return (
    <View style={{ flex: 1 }}>
      <ZinuMap center={start} onCenterChange={setCenter} accessibilityLabel={t('ride.moveMap')} />
      <View pointerEvents="none" style={styles.pinWrap}>
        <Ionicons name="location-sharp" size={48} color={field === 'pickup' ? colors.primary : colors.text} style={{ marginBottom: 44 }} />
      </View>
      <SafeAreaView edges={['bottom']} style={styles.card}>
        <DemoBanner />
        <Txt variant="caption" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
          {field === 'pickup' ? t('ride.pickup') : field === 'dropoff' ? t('ride.destination') : t('ride.moveMap')}
        </Txt>
        <View style={{ minHeight: 48, justifyContent: 'center' }} accessibilityLiveRegion="polite">
          {loading ? <ActivityIndicator color={colors.primary} /> : <Txt variant="bodyStrong">{place?.address ?? t('ride.moveMap')}</Txt>}
        </View>
        {!loading && !inService && field !== 'save' ? (
          <Txt color={colors.danger} style={{ marginBottom: spacing.sm }}>
            {t('ride.outsideArea')}
          </Txt>
        ) : null}
        <Button label={t('ride.confirmLocation')} onPress={confirm} disabled={loading || !place || (!inService && field !== 'save')} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  pinWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  card: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.xl, gap: spacing.xs },
});
