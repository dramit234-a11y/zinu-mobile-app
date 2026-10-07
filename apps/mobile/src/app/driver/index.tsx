import Ionicons from '@expo/vector-icons/Ionicons';
import { DriverVerificationStatus } from '@zinu/shared';
import { useFocusEffect, router } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { isoToDmy } from '../../components/forms';
import { NotificationBell } from '../../components/NotificationBell';
import { Badge, Button, Card, Screen, Txt, notify, showComingSoon, type IconName } from '../../components/ui';
import { useRegistration } from '../../lib/registration';
import { useSession } from '../../lib/session';
import { colors, radius, spacing } from '../../lib/theme';

/**
 * Spec §28 driver dashboard. Going online requires an APPROVED driver (spec §27); approval arrives
 * with Phase 2 verification and live requests with Phase 4, so figures are real zeros until then.
 */
export default function DriverHome() {
  const { t } = useTranslation();
  const user = useSession((s) => s.user);
  const { data: reg, refetch } = useRegistration();
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );
  const status = reg?.status ?? user?.driver?.verificationStatus ?? DriverVerificationStatus.NOT_SUBMITTED;
  const approved = status === DriverVerificationStatus.APPROVED;
  const eligible = approved && !!reg?.eligibility.canGoOnline;
  const in30Days = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const expiring = (reg?.documents ?? []).filter((d) => d.inForce?.status === 'APPROVED' && d.inForce.expiresOn && d.inForce.expiresOn <= in30Days);

  // Ride requests arrive in Phase 4; until then going online is explained rather than faked.
  const goOnline = () =>
    eligible ? showComingSoon() : notify(t('driver.goOnline'), approved ? (reg?.eligibility.reasons.map((r) => r.message).join('\n') ?? '') : t('driver.cannotGoOnline'));

  const cta = status === DriverVerificationStatus.NOT_SUBMITTED ? t('reg.continue') : status === DriverVerificationStatus.ADDITIONAL_INFO_REQUIRED ? t('reg.fix') : approved ? t('reg.renew') : t('reg.view');

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
        <NotificationBell />
      </View>

      <View style={styles.switchArea}>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: false, disabled: !eligible }}
          accessibilityLabel={t('driver.goOnline')}
          accessibilityHint={eligible ? undefined : t('driver.cannotGoOnline')}
          onPress={goOnline}
          style={[styles.switch, !eligible && { backgroundColor: colors.border }]}
        >
          <Ionicons name="power" size={44} color={eligible ? colors.textOnPrimary : colors.textMuted} />
          <Txt variant="heading" color={eligible ? colors.textOnPrimary : colors.textMuted} style={{ marginTop: spacing.xs }}>
            {t('driver.goOnline')}
          </Txt>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg }}>
          <View style={styles.offlineDot} />
          <Txt variant="bodyStrong">{t('driver.offline')}</Txt>
        </View>
      </View>

      {(!approved || !eligible || expiring.length > 0) && (
        <Card style={{ marginBottom: spacing.lg }}>
          <Txt variant="caption" color={colors.textMuted}>
            {t('driver.verification')}
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs, marginBottom: spacing.md }}>
            <Ionicons name={approved ? 'shield-checkmark' : 'shield-half'} size={20} color={colors.primary} />
            <Txt variant="bodyStrong" style={{ marginLeft: spacing.sm, flex: 1 }}>
              {t(`driver.status.${status}`)}
            </Txt>
          </View>
          {reg?.statusReason ? (
            <Txt color={colors.danger} style={{ marginBottom: spacing.md }}>
              {reg.statusReason}
            </Txt>
          ) : null}
          {approved && !eligible && reg ? (
            <View style={{ marginBottom: spacing.md }}>
              <Txt variant="bodyStrong">{t('reg.eligibilityTitle')}</Txt>
              {reg.eligibility.reasons.map((r) => (
                <Txt key={r.code + (r.docType ?? '')} color={colors.danger}>
                  • {r.message}
                </Txt>
              ))}
            </View>
          ) : null}
          {expiring.map((d) => (
            <View key={d.type.code} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
              <Ionicons name="alert-circle" size={18} color="#8A6100" />
              <Txt style={{ marginLeft: spacing.sm, flex: 1 }}>{t('reg.expiringSoon', { doc: d.type.label, date: isoToDmy(d.inForce!.expiresOn) })}</Txt>
            </View>
          ))}
          <Button label={cta} icon="document-text" onPress={() => router.push('/driver-registration')} />
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
