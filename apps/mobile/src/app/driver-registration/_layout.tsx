import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { RequireUser } from '../../components/RequireUser';
import { colors } from '../../lib/theme';

export default function RegistrationLayout() {
  const { t } = useTranslation();
  return (
    <RequireUser>
      <Stack screenOptions={{ headerTintColor: colors.primary, headerTitleStyle: { color: colors.text }, headerBackButtonDisplayMode: 'minimal' }}>
        <Stack.Screen name="index" options={{ title: t('reg.title') }} />
        <Stack.Screen name="personal" options={{ title: t('reg.steps.personal') }} />
        <Stack.Screen name="vehicle" options={{ title: t('reg.steps.vehicle') }} />
        <Stack.Screen name="documents" options={{ title: t('reg.steps.documents') }} />
        <Stack.Screen name="document" options={{ title: '' }} />
        <Stack.Screen name="payout" options={{ title: t('reg.steps.payout') }} />
      </Stack>
    </RequireUser>
  );
}
