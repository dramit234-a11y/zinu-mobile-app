import Ionicons from '@expo/vector-icons/Ionicons';
import type { PlaceDto } from '@zinu/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DemoBanner } from '../../components/DemoBanner';
import { Txt, notify, type IconName } from '../../components/ui';
import { errorMessage } from '../../i18n';
import { api } from '../../lib/api';
import { currentPosition } from '../../lib/location';
import { useRide } from '../../lib/ride';
import { colors, radius, spacing, type } from '../../lib/theme';

type Field = 'pickup' | 'dropoff';

/**
 * Spec §11: pickup + destination with autocomplete, saved and recent places, current location and Choose on Map.
 * With ?mode=save&label=HOME it picks a place to save instead of starting a ride.
 */
export default function SearchScreen() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ mode?: string; label?: 'HOME' | 'WORK' | 'OTHER' }>();
  const saving = params.mode === 'save';
  const ride = useRide();
  const [field, setField] = useState<Field>(saving ? 'dropoff' : 'dropoff');
  const [text, setText] = useState({ pickup: ride.pickup?.address ?? '', dropoff: saving ? '' : (ride.dropoff?.address ?? '') });
  const [debounced, setDebounced] = useState('');
  const [busy, setBusy] = useState(false);
  const query = text[field];

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const typing = debounced.length >= 2 && debounced !== (field === 'pickup' ? ride.pickup?.address : ride.dropoff?.address);
  const near = ride.here ?? ride.pickup ?? null;
  const suggestions = useQuery({
    queryKey: ['autocomplete', debounced, near?.lat.toFixed(2), near?.lng.toFixed(2)],
    queryFn: () => api.autocomplete(debounced, near, useRide.getState().sessionToken),
    enabled: typing,
    staleTime: 60_000,
  });
  const saved = useQuery({ queryKey: ['saved-places'], queryFn: api.savedPlaces });
  const recent = useQuery({ queryKey: ['recent-places'], queryFn: api.recentPlaces, enabled: !saving });

  const choose = async (place: PlaceDto) => {
    if (saving) {
      try {
        await api.savePlace({ ...place, label: params.label ?? 'OTHER' });
        await qc.invalidateQueries({ queryKey: ['saved-places'] });
        router.back();
      } catch (e) {
        notify(errorMessage(e));
      }
      return;
    }
    const s = useRide.getState();
    if (field === 'pickup') s.setPickup(place);
    else s.setDropoff(place);
    setText((x) => ({ ...x, [field]: place.address }));
    const pickup = field === 'pickup' ? place : s.pickup;
    const dropoff = field === 'dropoff' ? place : s.dropoff;
    if (pickup && dropoff) router.push('/ride/options');
    else setField(pickup ? 'dropoff' : 'pickup');
  };

  const pickSuggestion = async (placeId: string) => {
    setBusy(true);
    try {
      const { place } = await api.placeDetails(placeId, useRide.getState().sessionToken);
      useRide.getState().newSession(); // a Places session ends with the details call
      await choose(place);
    } catch (e) {
      notify(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const useCurrent = async () => {
    setBusy(true);
    const here = await currentPosition();
    if (!here) {
      setBusy(false);
      return notify(t('ride.locTitle'), t('ride.locDenied'));
    }
    useRide.getState().setHere(here);
    try {
      await choose((await api.reverseGeocode(here)).place);
    } catch (e) {
      notify(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: saving ? t('ride.savePlaceAs', { label: t(`ride.labels.${params.label ?? 'OTHER'}`) }) : t('passenger.whereTo') }} />
      <View style={styles.fields}>
        {!saving && (
          <FieldInput icon="ellipse" iconColor={colors.primary} label={t('ride.pickup')} placeholder={t('ride.whereFrom')} value={text.pickup} active={field === 'pickup'} onFocus={() => setField('pickup')} onChange={(v) => setText((x) => ({ ...x, pickup: v }))} />
        )}
        <FieldInput icon="square" iconColor={colors.text} label={t('ride.destination')} placeholder={t('passenger.whereTo')} value={text.dropoff} active={field === 'dropoff'} onFocus={() => setField('dropoff')} onChange={(v) => setText((x) => ({ ...x, dropoff: v }))} autoFocus />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.sm }}>
          <DemoBanner provider={suggestions.data?.provider} />
        </View>
        {busy && <ActivityIndicator color={colors.primary} style={{ margin: spacing.md }} />}
        {!typing && (
          <>
            {field === 'pickup' && <Row icon="locate" title={t('ride.useCurrent')} onPress={useCurrent} />}
            <Row icon="map" title={t('ride.chooseOnMap')} onPress={() => router.push({ pathname: '/ride/pick', params: { field: saving ? 'save' : field, label: params.label ?? '' } })} />
            {!!saved.data?.length && <Section title={t('ride.saved')} />}
            {saved.data?.map((p) => (
              <Row key={p.id} icon={p.label === 'HOME' ? 'home' : p.label === 'WORK' ? 'briefcase' : 'bookmark'} title={p.name ?? t(`ride.labels.${p.label}`)} subtitle={p.address} onPress={() => choose(p)} />
            ))}
            {!saving && !!recent.data?.length && <Section title={t('ride.recent')} />}
            {!saving && recent.data?.map((p) => <Row key={p.address} icon="time" title={p.name ?? p.address} subtitle={p.name ? p.address : undefined} onPress={() => choose(p)} />)}
          </>
        )}
        {typing && (
          <>
            <Section title={t('ride.suggestions')} />
            {suggestions.isFetching && !suggestions.data && <ActivityIndicator color={colors.primary} style={{ margin: spacing.md }} />}
            {suggestions.error ? <Txt style={{ paddingHorizontal: spacing.xl }} color={colors.danger}>{errorMessage(suggestions.error)}</Txt> : null}
            {suggestions.data?.suggestions.map((s) => (
              <Row key={s.placeId} icon="location" title={s.primary} subtitle={s.secondary} meta={s.distanceM !== undefined ? `${(s.distanceM / 1000).toFixed(1)} km` : undefined} onPress={() => pickSuggestion(s.placeId)} />
            ))}
            {suggestions.data && suggestions.data.suggestions.length === 0 && (
              <Txt color={colors.textMuted} style={{ padding: spacing.xl }}>
                {t('ride.noResults')}
              </Txt>
            )}
            <Row icon="map" title={t('ride.chooseOnMap')} onPress={() => router.push({ pathname: '/ride/pick', params: { field: saving ? 'save' : field, label: params.label ?? '' } })} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function FieldInput(props: { icon: IconName; iconColor: string; label: string; placeholder: string; value: string; active: boolean; autoFocus?: boolean; onFocus: () => void; onChange: (v: string) => void }) {
  return (
    <View style={[styles.field, props.active && { borderColor: colors.primary }]}>
      <Ionicons name={props.icon} size={12} color={props.iconColor} />
      <TextInput
        accessibilityLabel={props.label}
        placeholder={props.placeholder}
        placeholderTextColor={colors.textMuted}
        value={props.value}
        onFocus={props.onFocus}
        onChangeText={props.onChange}
        autoFocus={props.autoFocus}
        autoCorrect={false}
        selectTextOnFocus
        style={[type.body, styles.input]}
      />
      {props.value ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear" onPress={() => props.onChange('')} hitSlop={10}>
          <Ionicons name="close-circle" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const Section = ({ title }: { title: string }) => (
  <Txt variant="caption" color={colors.textMuted} style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xs, fontWeight: '700', textTransform: 'uppercase' }}>
    {title}
  </Txt>
);

function Row({ icon, title, subtitle, meta, onPress }: { icon: IconName; title: string; subtitle?: string; meta?: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title} onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <Txt variant="bodyStrong" numberOfLines={1}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="caption" color={colors.textMuted} numberOfLines={1}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {meta ? (
        <Txt variant="caption" color={colors.textMuted}>
          {meta}
        </Txt>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fields: { padding: spacing.lg, gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  field: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, minHeight: 50, backgroundColor: colors.surface, gap: spacing.sm },
  // Field border shows focus; drop the browser outline in the web preview.
  input: { flex: 1, color: colors.text, paddingVertical: spacing.sm, ...(Platform.OS === 'web' ? { outlineStyle: 'none' as never } : null) },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 60, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  rowIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
