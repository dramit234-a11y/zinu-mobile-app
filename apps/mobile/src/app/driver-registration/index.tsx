import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, Screen, Txt, notify, type IconName } from '../../components/ui';
import { errorMessage } from '../../i18n';
import { api } from '../../lib/api';
import { useRegistration, useSetRegistration } from '../../lib/registration';
import { colors, radius, spacing } from '../../lib/theme';

const STEPS: { key: 'personal' | 'vehicle' | 'documents' | 'payout' | 'emergencyContact'; icon: IconName; href: Href }[] = [
  { key: 'personal', icon: 'person', href: '/driver-registration/personal' },
  { key: 'vehicle', icon: 'car', href: '/driver-registration/vehicle' },
  { key: 'documents', icon: 'documents', href: '/driver-registration/documents' },
  { key: 'payout', icon: 'business', href: '/driver-registration/payout' },
  { key: 'emergencyContact', icon: 'call', href: '/settings/contacts' },
];

/** Spec §26: overview of the driver registration with a checklist, then submit for verification (spec §27). */
export default function RegistrationOverview() {
  const { t } = useTranslation();
  const { data: reg, isLoading, refetch } = useRegistration();
  const setRegistration = useSetRegistration();
  const [submitting, setSubmitting] = useState(false);
  // Some steps (emergency contacts) are edited on other screens: refresh when coming back.
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  if (isLoading || !reg)
    return (
      <Screen edges={['bottom']}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
      </Screen>
    );

  const done = STEPS.filter((s) => reg.checklist[s.key]).length;

  const submit = async () => {
    setSubmitting(true);
    try {
      setRegistration(await api.submitRegistration());
      notify(t('reg.submitted'), t('reg.submittedBody'));
    } catch (e) {
      notify(errorMessage(e));
      refetch();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <Card style={{ marginBottom: spacing.lg }}>
        <Txt variant="caption" color={colors.textMuted}>
          {t('driver.verification')}
        </Txt>
        <Txt variant="heading" style={{ marginTop: 2 }}>
          {t(`driver.status.${reg.status}`)}
        </Txt>
        {reg.statusReason ? (
          <View style={styles.reason} accessibilityLiveRegion="polite">
            <Ionicons name="information-circle" size={20} color={colors.danger} />
            <Txt style={{ flex: 1, marginLeft: spacing.sm }}>{reg.statusReason}</Txt>
          </View>
        ) : null}
        <Txt color={colors.textMuted} style={{ marginTop: spacing.sm }}>
          {reg.editable ? t('reg.intro') : t('reg.locked')}
        </Txt>
      </Card>

      <Txt variant="bodyStrong" style={{ marginBottom: spacing.sm }}>
        {t('reg.progress', { done, total: STEPS.length })}
      </Txt>
      <View style={styles.bar} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: STEPS.length, now: done }}>
        <View style={[styles.barFill, { width: `${(done / STEPS.length) * 100}%` }]} />
      </View>

      {STEPS.map((s) => {
        const ok = reg.checklist[s.key];
        // Documents stay reachable after approval for renewals.
        const reachable = reg.editable || s.key === 'documents' || s.key === 'payout' || s.key === 'emergencyContact';
        return (
          <Pressable
            key={s.key}
            accessibilityRole="button"
            accessibilityLabel={`${t(`reg.steps.${s.key}`)}, ${ok ? t('reg.done') : t('reg.todo')}`}
            disabled={!reachable}
            onPress={() => router.push(s.href)}
            style={({ pressed }) => [styles.step, pressed && { backgroundColor: colors.surface }, !reachable && { opacity: 0.6 }]}
          >
            <View style={[styles.stepIcon, ok && { backgroundColor: colors.primary }]}>
              <Ionicons name={ok ? 'checkmark' : s.icon} size={22} color={ok ? colors.textOnPrimary : colors.primary} />
            </View>
            <Txt variant="bodyStrong" style={{ flex: 1, marginLeft: spacing.md }}>
              {t(`reg.steps.${s.key}`)}
            </Txt>
            <Txt variant="caption" color={ok ? colors.success : colors.textMuted} style={{ marginRight: spacing.sm, fontWeight: '600' }}>
              {ok ? t('reg.done') : t('reg.todo')}
            </Txt>
            {reachable && <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
          </Pressable>
        );
      })}

      {reg.editable && <Button label={t('reg.submit')} onPress={submit} disabled={!reg.canSubmit} loading={submitting} style={{ marginTop: spacing.xl }} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  reason: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.border, marginBottom: spacing.lg, overflow: 'hidden' },
  barFill: { height: 8, backgroundColor: colors.primary },
  step: { flexDirection: 'row', alignItems: 'center', minHeight: 64, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  stepIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
