import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { EmptyState, Screen, Txt } from '../../components/ui';
import { colors, radius, spacing } from '../../lib/theme';

const TABS = ['upcoming', 'completed', 'cancelled'] as const;

/** Spec §48 (passenger): Upcoming / Completed / Cancelled. Trips arrive with the ride lifecycle phase. */
export default function PassengerTrips() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<(typeof TABS)[number]>('upcoming');
  return (
    <Screen edges={['top']}>
      <Txt variant="title" accessibilityRole="header">
        {t('passenger.tabs.trips')}
      </Txt>
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }} accessibilityRole="tablist">
        {TABS.map((k) => (
          <Pressable
            key={k}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === k }}
            onPress={() => setTab(k)}
            style={{ minHeight: 44, paddingHorizontal: spacing.lg, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: tab === k ? colors.primary : colors.surface }}
          >
            <Txt variant="bodyStrong" color={tab === k ? colors.textOnPrimary : colors.text}>
              {t(`passenger.tripsTabs.${k}`)}
            </Txt>
          </Pressable>
        ))}
      </View>
      <EmptyState icon="time" title={t('passenger.tripsEmpty')} body={t('passenger.tripsEmptyBody')} />
    </Screen>
  );
}
