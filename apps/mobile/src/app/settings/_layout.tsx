import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { RequireUser } from '../../components/RequireUser';
import { colors } from '../../lib/theme';

export default function SettingsLayout() {
  const { t } = useTranslation();
  return (
    <RequireUser>
      <Stack screenOptions={{ headerTintColor: colors.primary, headerTitleStyle: { color: colors.text }, headerBackButtonDisplayMode: 'minimal' }}>
        <Stack.Screen name="personal" options={{ title: t('menu.personal') }} />
        <Stack.Screen name="contacts" options={{ title: t('contacts.title') }} />
      </Stack>
    </RequireUser>
  );
}
