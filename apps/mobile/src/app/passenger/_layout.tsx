import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';
import type { ColorValue } from 'react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { RequireUser } from '../../components/RequireUser';
import { Txt, type IconName } from '../../components/ui';
import { colors } from '../../lib/theme';

const icon = (name: IconName) =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color} size={size} />;
  };

/** Spec §10: Home | Trips | Book | Wallet | Profile, with Book as the prominent centre action. */
export default function PassengerTabs() {
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
        <Tabs.Screen name="index" options={{ title: t('passenger.tabs.home'), tabBarIcon: icon('home') }} />
        <Tabs.Screen name="trips" options={{ title: t('passenger.tabs.trips'), tabBarIcon: icon('time') }} />
        <Tabs.Screen
          name="book"
          // Book is an action, not a destination: it opens destination search (spec §10).
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              router.push('/ride/search');
            },
          }}
          options={{
            title: t('passenger.tabs.book'),
            // Raised centre action: the button renders its own icon and label.
            tabBarButton: ({ onPress, accessibilityState, style }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('passenger.tabs.book')}
                accessibilityState={accessibilityState}
                onPress={onPress}
                style={[style, styles.bookSlot]}
              >
                <View style={styles.bookButton}>
                  <Ionicons name="car-sport" size={28} color={colors.textOnPrimary} />
                </View>
                <Txt variant="caption" color={accessibilityState?.selected ? colors.primary : colors.text} style={styles.bookLabel}>
                  {t('passenger.tabs.book')}
                </Txt>
              </Pressable>
            ),
          }}
        />
        <Tabs.Screen name="wallet" options={{ title: t('passenger.tabs.wallet'), tabBarIcon: icon('wallet') }} />
        <Tabs.Screen name="profile" options={{ title: t('passenger.tabs.profile'), tabBarIcon: icon('person') }} />
      </Tabs>
    </RequireUser>
  );
}

const styles = StyleSheet.create({
  bookSlot: { alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 6 },
  bookLabel: { fontWeight: '700', marginTop: 2 },
  bookButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -26,
    borderWidth: 4,
    borderColor: colors.background,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
});
