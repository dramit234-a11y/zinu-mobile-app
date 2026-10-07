import Ionicons from '@expo/vector-icons/Ionicons';
import { DriverVerificationStatus } from '@zinu/shared';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { Badge, Button, Card, Screen, Txt, notify, showComingSoon, type IconName } from '../../components/ui';
import { useSession } from '../../lib/session';
import { colors, radius, spacing } from '../../lib/theme';

/**
 * Spec §28 driver dashboard. Going online requires an APPROVED driver (spec §27); approval arrives
 * with Phase 2 verification and live requests with Phase 4, so figures are real zeros until then.
 */
export default function DriverHome() {
  const { t } = useTranslation();
  const user = useSession((s) => s.user);
  const status = user?.driver?.verificationStatus ?? DriverVerificationStatus.NOT_SUBMITTED;
  const approved = status === DriverVerificationStatus.APPROVED;

  const goOnline = () => (approved ? showComingSoon() : notify(t('driver.goOnline'), t('driver.cannotGoOnline')));

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={24} color={colors.primary} />
        </View>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Txt variant="heading">{user?.fullName ?? ''}</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <Ionicons name="star" size={14} color={colors.accent} />
            <Txt variant="caption" color={colors.textMuted} style={{ marginLeft: 4 }}>
              {t('driver.rating')}: {t('driver.notRated')}
            </Txt>
          </View>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('menu.notifications')} onPress={showComingSoon} style={styles.iconButton}>
          <Ionicons name="notifications-outline" size={26} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.switchArea}>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: false, disabled: !approved }}
          accessibilityLabel={t('driver.goOnline')}
          accessibilityHint={approved ? undefined : t('driver.cannotGoOnline')}
          onPress={goOnline}
          style={[styles.switch, !approved && { backgroundColor: colors.border }]}
        >
          <Ionicons name="power" size={44} color={approved ? colors.textOnPrimary : colors.textMuted} />
          <Txt variant="heading" color={approved ? colors.textOnPrimary : colors.textMuted} style={{ marginTop: spacing.xs }}>
            {t('driver.goOnline')}
          </Txt>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg }}>
          <View style={styles.offlineDot} />
          <Txt variant="bodyStrong">{t('driver.offline')}</Txt>
        </View>
      </View>

      {!approved && (
        <Card style={{ marginBottom: spacing.lg }}>
          <Txt variant="caption" color={colors.textMuted}>
            {t('driver.verification')}
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs, marginBottom: spacing.md }}>
            <Ionicons name="shield-half" size={20} color={colors.primary} />
            <Txt variant="bodyStrong" style={{ marginLeft: spacing.sm, flex: 1 }}>
              {t(`driver.status.${status}`)}
            </Txt>
          </View>
          <Button label={t('driver.startRegistration')} icon="document-text" onPress={() => notify(t('driver.startRegistration'), t('driver.registrationSoon'))} />
        </Card>
      )}

      <View style={styles.grid}>
        <Stat icon="cash" label={t('driver.todayEarnings')} value="₹0" />
        <Stat icon="car" label={t('driver.todayTrips')} value="0" />
        <Stat icon="timer" label={t('driver.onlineTime')} value="0m" />
        <Pressable accessibilityRole="button" onPress={showComingSoon} style={styles.stat}>
          <Ionicons name="flag" size={22} color={colors.primary} />
          <Txt variant="caption" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
            {t('driver.dailyGoal')}
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
            <Txt variant="bodyStrong" color={colors.primary}>
              {t('driver.setGoal')}
            </Txt>
            <View style={{ marginLeft: spacing.sm }}>
              <Badge label={t('common.soon')} />
            </View>
          </View>
        </Pressable>
      </View>
    </Screen>
  );
}

function Stat({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      <Txt variant="caption" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
        {label}
      </Txt>
      <Txt variant="title" style={{ marginTop: 2 }}>
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  switchArea: { alignItems: 'center', marginVertical: spacing.xxl },
  switch: {
    width: 168,
    height: 168,
    borderRadius: 84,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 8,
    borderColor: colors.primarySoft,
  },
  offlineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.textMuted, marginRight: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.md },
  stat: { width: '48%', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
});
