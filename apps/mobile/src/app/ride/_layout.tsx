import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { RequireUser } from '../../components/RequireUser';
import { colors } from '../../lib/theme';

export default function RideLayout() {
  const { t } = useTranslation();
  return (
    <RequireUser>
      <Stack screenOptions={{ headerTintColor: colors.primary, headerTitleStyle: { color: colors.text }, headerBackButtonDisplayMode: 'minimal' }}>
        <Stack.Screen name="search" options={{ title: t('passenger.whereTo') }} />
        <Stack.Screen name="pick" options={{ title: t('ride.chooseOnMap') }} />
        <Stack.Screen name="options" options={{ title: t('ride.options') }} />
      </Stack>
    </RequireUser>
  );
}
