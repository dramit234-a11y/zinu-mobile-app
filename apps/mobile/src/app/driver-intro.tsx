import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Button, Card, Screen, TextField, Txt, notify } from '../components/ui';
import { errorMessage } from '../i18n';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { colors, spacing } from '../lib/theme';

/**
 * Entry to "Drive & Earn" (spec §26). Phase 1 creates the driver role in ONBOARDING state;
 * the full registration (vehicle, documents, payout) is added in Phase 2.
 */
export default function DriverIntro() {
  const { t } = useTranslation();
  const user = useSession((s) => s.user);
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (fullName.trim().length < 2) return setError(t('profile.nameRequired'));
    setSaving(true);
    try {
      if (fullName.trim() !== user?.fullName) await api.updateMe({ fullName: fullName.trim() });
      const me = await api.activateRole('DRIVER');
      useSession.getState().setUser(me);
      await useSession.getState().setMode('driver');
      router.replace('/driver');
    } catch (e) {
      notify(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <View style={{ alignItems: 'center', marginTop: spacing.xl }}>
        <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="speedometer" size={48} color={colors.text} />
        </View>
      </View>
      <Txt variant="title" accessibilityRole="header" style={{ textAlign: 'center', marginTop: spacing.xl }}>
        {t('driver.introTitle')}
      </Txt>
      <Card style={{ marginVertical: spacing.xl }}>
        <Txt color={colors.textMuted}>{t('driver.introBody')}</Txt>
      </Card>
      <TextField label={t('profile.fullName')} value={fullName} onChangeText={(v) => (setFullName(v), setError(null))} autoComplete="name" error={error} />
      <View style={{ flex: 1 }} />
      <Button label={t('driver.introCta')} onPress={submit} loading={saving} />
    </Screen>
  );
}
