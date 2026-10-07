import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';
import type { ColorValue } from 'react-native';
import { RequireUser } from '../../components/RequireUser';
import type { IconName } from '../../components/ui';
import { colors } from '../../lib/theme';

const icon = (name: IconName) =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color} size={size} />;
  };

/** Spec §28: Home | Requests | Earnings | Trips | Profile. */
export default function DriverTabs() {
  const { t } = useTranslation();
  return (
    <RequireUser>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
          tabBarStyle: { minHeight: 64 },
        }}
      >
        <Tabs.Screen name="index" options={{ title: t('driver.tabs.home'), tabBarIcon: icon('speedometer') }} />
        <Tabs.Screen name="requests" options={{ title: t('driver.tabs.requests'), tabBarIcon: icon('notifications') }} />
        <Tabs.Screen name="earnings" options={{ title: t('driver.tabs.earnings'), tabBarIcon: icon('cash') }} />
        <Tabs.Screen name="trips" options={{ title: t('driver.tabs.trips'), tabBarIcon: icon('time') }} />
        <Tabs.Screen name="profile" options={{ title: t('driver.tabs.profile'), tabBarIcon: icon('person') }} />
      </Tabs>
    </RequireUser>
  );
}
