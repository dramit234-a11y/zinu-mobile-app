import '../i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { setSessionExpiredHandler } from '../lib/api';
import { useSession } from '../lib/session';
import { colors } from '../lib/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1 } } }));

  useEffect(() => {
    // Refresh token rejected (expired, revoked, account blocked): back to login.
    setSessionExpiredHandler(() => {
      useSession.getState().setUser(null);
      router.replace('/phone');
    });
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="index" options={{ animation: 'fade' }} />
          <Stack.Screen name="passenger" options={{ animation: 'fade' }} />
          <Stack.Screen name="driver" options={{ animation: 'fade' }} />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
