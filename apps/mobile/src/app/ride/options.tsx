import Ionicons from '@expo/vector-icons/Ionicons';
import { decodePolyline, formatRupees, type QuoteOptionDto } from '@zinu/shared';
import { useQuery } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DemoBanner } from '../../components/DemoBanner';
import { ZinuMap } from '../../components/map/ZinuMap';
import { Button, Txt, notify, type IconName } from '../../components/ui';
import { errorMessage } from '../../i18n';
import { ApiError, api } from '../../lib/api';
import { useRide } from '../../lib/ride';
import { colors, radius, spacing } from '../../lib/theme';

const ICONS: Record<string, IconName> = { BIKE: 'bicycle', TOTO: 'flash', AUTO: 'car', CAB: 'car-sport', SHARED: 'people' };

/** Spec §12 ride options and §13 fare breakdown, priced by the server from admin-configured fares. */
export default function RideOptions() {
  const { t } = useTranslation();
  const { pickup, dropoff, preferredCategory } = useRide();
  const quote = useQuery({
    queryKey: ['quote', pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng],
    queryFn: () => api.quote(pickup!, dropoff!),
    enabled: !!pickup && !!dropoff,
    retry: false,
    staleTime: 0,
  });
  const [selected, setSelected] = useState<string | null>(preferredCategory);
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Quotes expire (10 min); refresh when coming back to an expired one.
  useFocusEffect(
    useCallback(() => {
      if (quote.data && new Date(quote.data.expiresAt) < new Date()) quote.refetch();
    }, [quote]),
  );

  const route = useMemo(() => (quote.data ? decodePolyline(quote.data.route.polyline) : []), [quote.data]);
  const options = quote.data?.options ?? [];
  const chosen: QuoteOptionDto | undefined = options.find((o) => o.category === selected) ?? options[0];
  const error = quote.error as ApiError | null;
  const errorText =
    error?.code === 'OUT_OF_SERVICE_AREA' ? ((error.details as { which?: string })?.which === 'dropoff' ? error.message : t('ride.outsideArea')) : error ? errorMessage(error) : null;

  if (!pickup || !dropoff) {
    router.replace('/ride/search');
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ height: '36%' }}>
        <ZinuMap
          center={pickup}
          markers={[
            { id: 'p', at: pickup, kind: 'pickup' },
            { id: 'd', at: dropoff, kind: 'dropoff' },
          ]}
          route={route}
          fitTo={route.length ? route : [pickup, dropoff]}
        />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.trip}>
          <View style={{ flex: 1 }}>
            <Txt numberOfLines={1}>
              <Txt color={colors.primary}>● </Txt>
              {pickup.address}
            </Txt>
            <Txt numberOfLines={1} style={{ marginTop: 2 }}>
              <Txt>■ </Txt>
              {dropoff.address}
            </Txt>
          </View>
          <Txt variant="bodyStrong" color={colors.primary}>
            {t('ride.change')}
          </Txt>
        </Pressable>
        <DemoBanner provider={quote.data?.provider} />

        {quote.isLoading && <ActivityIndicator color={colors.primary} style={{ margin: spacing.xl }} />}
        {errorText ? (
          <View style={{ padding: spacing.lg }}>
            <Txt color={colors.danger}>{errorText}</Txt>
            <Button label={t('ride.retryQuote')} variant="secondary" onPress={() => quote.refetch()} style={{ marginTop: spacing.md }} />
          </View>
        ) : null}

        {quote.data && (
          <Txt variant="caption" color={colors.textMuted}>
            {t('ride.distance', { km: (quote.data.route.distanceM / 1000).toFixed(1) })} · {t('ride.tripTime', { min: Math.round(quote.data.route.durationS / 60) })} · {t('ride.pickupEta')}
          </Txt>
        )}

        <View accessibilityRole="radiogroup">
          {options.map((o) => {
            const active = o.quoteId === chosen?.quoteId;
            return (
              <Pressable
                key={o.quoteId}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                accessibilityLabel={`${o.name}, ${o.description}, ${formatRupees(o.fare.totalPaise)}${o.perSeat ? ` ${t('ride.perSeat')}` : ''}`}
                onPress={() => setSelected(o.category)}
                style={[styles.option, active && styles.optionActive]}
              >
                <View style={styles.optionIcon}>
                  <Ionicons name={ICONS[o.category] ?? 'car'} size={26} color={colors.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Txt variant="bodyStrong">{o.name}</Txt>
                  <Txt variant="caption" color={colors.textMuted}>
                    {o.description}
                  </Txt>
                  <Txt variant="caption" color={colors.textMuted}>
                    <Ionicons name="person" size={11} color={colors.textMuted} /> {t('ride.capacity', { n: o.capacity })} · {t('ride.tripTime', { min: Math.round(o.durationS / 60) })}
                  </Txt>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Txt variant="heading">{formatRupees(o.fare.totalPaise)}</Txt>
                  {o.perSeat && (
                    <Txt variant="caption" color={colors.textMuted}>
                      {t('ride.perSeat')}
                    </Txt>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>

        {chosen && (
          <View style={styles.breakdown}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: showBreakdown }} onPress={() => setShowBreakdown((v) => !v)} style={styles.breakdownHead}>
              <Txt variant="bodyStrong">{showBreakdown ? t('ride.hideDetails') : t('ride.fareDetails')}</Txt>
              <Ionicons name={showBreakdown ? 'chevron-up' : 'chevron-down'} size={18} color={colors.text} />
            </Pressable>
            {showBreakdown && (
              <View style={{ marginTop: spacing.sm }}>
                {chosen.fare.lines.map((l) => (
                  <View key={l.code} style={styles.line}>
                    <Txt color={colors.textMuted}>{t(`ride.lines.${l.code}`)}</Txt>
                    <Txt>{formatRupees(l.amountPaise)}</Txt>
                  </View>
                ))}
                <View style={[styles.line, styles.total]}>
                  <Txt variant="bodyStrong">{t('ride.estimated')}</Txt>
                  <Txt variant="bodyStrong">{formatRupees(chosen.fare.totalPaise)}</Txt>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>
      {chosen && (
        <SafeAreaView edges={['bottom']} style={styles.footer}>
          <Button label={`${t('ride.confirm')} · ${formatRupees(chosen.fare.totalPaise)}`} onPress={() => notify(t('ride.confirm'), t('ride.bookingSoon'))} />
        </SafeAreaView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  trip: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.md },
  option: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.lg, borderWidth: 2, borderColor: colors.border, marginTop: spacing.sm, minHeight: 72 },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  breakdown: { borderRadius: radius.lg, backgroundColor: colors.surface, padding: spacing.md, marginTop: spacing.sm },
  breakdownHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 40 },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  total: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, marginTop: spacing.xs, paddingTop: spacing.sm },
  footer: { padding: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.background },
});
