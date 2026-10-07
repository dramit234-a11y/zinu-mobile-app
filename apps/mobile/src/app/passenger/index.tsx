import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { Screen, Txt, showComingSoon, type IconName } from '../../components/ui';
import { useSession } from '../../lib/session';
import { colors, radius, spacing } from '../../lib/theme';

const SERVICES: { key: 'bike' | 'toto' | 'auto' | 'cab' | 'shared' | 'schedule'; icon: IconName }[] = [
  { key: 'bike', icon: 'bicycle' },
  { key: 'toto', icon: 'flash' },
  { key: 'auto', icon: 'car' },
  { key: 'cab', icon: 'car-sport' },
  { key: 'shared', icon: 'people' },
  { key: 'schedule', icon: 'calendar' },
];

const QUICK: { key: 'home' | 'work' | 'recent' | 'saved'; icon: IconName }[] = [
  { key: 'home', icon: 'home' },
  { key: 'work', icon: 'briefcase' },
  { key: 'recent', icon: 'time' },
  { key: 'saved', icon: 'bookmark' },
];

/** Spec §10 layout. Map, location and booking are wired up in Phases 3–4. */
export default function PassengerHome() {
  const { t } = useTranslation();
  const user = useSession((s) => s.user);
  const firstName = user?.fullName?.split(' ')[0] ?? '';

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Txt variant="caption" color={colors.textMuted}>
            {t('passenger.currentLocation')}
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="location" size={18} color={colors.primary} />
            <Txt variant="bodyStrong" style={{ marginLeft: 4 }}>
              Ranchi
            </Txt>
          </View>
        </View>
        <IconButton icon="notifications-outline" label={t('menu.notifications')} onPress={showComingSoon} />
        <IconButton icon="person-circle-outline" label={t('passenger.tabs.profile')} onPress={() => router.push('/passenger/profile')} />
      </View>

      <Txt variant="title" style={{ marginTop: spacing.lg }}>
        {t('passenger.hello', { name: firstName })}
      </Txt>

      <Pressable accessibilityRole="search" accessibilityLabel={t('passenger.whereTo')} onPress={() => router.push('/passenger/book')} style={styles.search}>
        <Ionicons name="search" size={22} color={colors.primary} />
        <Txt variant="heading" color={colors.textMuted} style={{ marginLeft: spacing.md }}>
          {t('passenger.whereTo')}
        </Txt>
      </Pressable>

      <View style={styles.quickRow}>
        {QUICK.map((q) => (
          <Pressable key={q.key} accessibilityRole="button" onPress={showComingSoon} style={styles.quick}>
            <Ionicons name={q.icon} size={18} color={colors.primary} />
            <Txt variant="caption" style={{ marginLeft: 6, fontWeight: '600' }}>
              {t(`passenger.quick.${q.key}`)}
            </Txt>
          </Pressable>
        ))}
      </View>

      <View style={styles.map} accessible accessibilityLabel={t('passenger.mapSoon')}>
        <Ionicons name="map" size={40} color={colors.primary} />
        <Txt color={colors.textMuted} style={{ textAlign: 'center', marginTop: spacing.sm }}>
          {t('passenger.mapSoon')}
        </Txt>
      </View>

      <Txt variant="heading" style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
        {t('passenger.services')}
      </Txt>
      <View style={styles.grid}>
        {SERVICES.map((s) => (
          <Pressable key={s.key} accessibilityRole="button" accessibilityLabel={t(`passenger.service.${s.key}`)} onPress={() => router.push('/passenger/book')} style={styles.service}>
            <Ionicons name={s.icon} size={30} color={colors.primary} />
            <Txt variant="bodyStrong" style={{ marginTop: spacing.sm }}>
              {t(`passenger.service.${s.key}`)}
            </Txt>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

function IconButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.iconButton}>
      <Ionicons name={icon} size={26} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    minHeight: 60,
    marginTop: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  quick: { flexDirection: 'row', alignItems: 'center', minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  map: { height: 150, borderRadius: radius.lg, backgroundColor: colors.surface, marginTop: spacing.lg, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.md },
  service: { width: '31%', aspectRatio: 1, borderRadius: radius.lg, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
});
