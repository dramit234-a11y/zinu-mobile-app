import Ionicons from '@expo/vector-icons/Ionicons';
import * as Network from 'expo-network';
import { router, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Logo, Txt } from '../components/ui';
import { loadSavedLanguage } from '../i18n';
import { ApiError, api, clearTokens, hasStoredSession } from '../lib/api';
import { APP_VERSION } from '../lib/config';
import { homeRoute, useSession, type Mode } from '../lib/session';
import { PrefKeys, prefs } from '../lib/storage';
import { colors, spacing } from '../lib/theme';

type Blocker = 'offline' | 'server' | 'update' | null;
const MIN_SPLASH_MS = 1400;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Splash (spec §3): animated brand entrance while checking connectivity, app version,
 * stored session and role, then routes to language / onboarding / login / dashboard.
 */
export default function Splash() {
  const { t } = useTranslation();
  const [blocker, setBlocker] = useState<Blocker>(null);
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(scale, { toValue: 1, duration: 800, easing: Easing.out(Easing.back(1.6)), useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
  }, [fade, scale]);

  const bootstrap = useCallback(async () => {
    setBlocker(null);
    const started = Date.now();

    const net = await Network.getNetworkStateAsync().catch(() => null);
    if (net?.isConnected === false) return setBlocker('offline');

    const language = await loadSavedLanguage();

    try {
      const cfg = await api.appConfig(Platform.OS, APP_VERSION);
      if (cfg.updateRequired) return setBlocker('update');
      useSession.setState({ mapsProvider: cfg.mapsProvider });
    } catch {
      return setBlocker('server');
    }

    let next: Href;
    if (!language) next = '/language';
    else if (!(await prefs.get(PrefKeys.onboardingSeen))) next = '/onboarding';
    else if (!(await hasStoredSession())) next = '/phone';
    else {
      try {
        const me = await api.me();
        const mode = ((await prefs.get(PrefKeys.activeMode)) as Mode | null) ?? 'passenger';
        useSession.setState({ user: me, mode });
        next = homeRoute(me, mode);
      } catch (e) {
        if (e instanceof ApiError && e.code === 'NETWORK') return setBlocker('server');
        await clearTokens();
        next = '/phone';
      }
    }

    await wait(Math.max(0, MIN_SPLASH_MS - (Date.now() - started)));
    router.replace(next);
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const messages = {
    offline: { icon: 'cloud-offline' as const, title: t('splash.offlineTitle'), body: t('splash.offlineBody') },
    server: { icon: 'warning' as const, title: t('splash.serverTitle'), body: t('splash.serverBody') },
    update: { icon: 'arrow-up-circle' as const, title: t('splash.updateTitle'), body: t('splash.updateBody') },
  };
  const msg = blocker ? messages[blocker] : null;

  return (
    <SafeAreaView style={styles.root}>
      <Animated.View style={[styles.center, { opacity: fade, transform: [{ scale }] }]}>
        <Logo size={112} light />
        <Txt variant="display" color={colors.textOnPrimary} style={{ marginTop: spacing.xl, fontSize: 44, letterSpacing: 6 }}>
          ZINU
        </Txt>
        <Txt variant="heading" color={colors.textOnPrimary} style={{ marginTop: spacing.sm }}>
          {t('brand.tagline')}
        </Txt>
      </Animated.View>

      {msg ? (
        <View style={styles.blocker} accessibilityLiveRegion="assertive">
          <Ionicons name={msg.icon} size={32} color={colors.primary} />
          <Txt variant="heading" style={{ marginTop: spacing.sm, textAlign: 'center' }}>
            {msg.title}
          </Txt>
          <Txt color={colors.textMuted} style={{ textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.lg }}>
            {msg.body}
          </Txt>
          {blocker !== 'update' && <Button label={t('common.retry')} onPress={bootstrap} icon="refresh" style={{ alignSelf: 'stretch' }} />}
        </View>
      ) : (
        <Txt color={colors.primarySoft} style={styles.footer}>
          {t('brand.sub')}
        </Txt>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  center: { alignItems: 'center' },
  footer: { position: 'absolute', bottom: 48 },
  blocker: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: 40,
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: spacing.xl,
    alignItems: 'center',
  },
});
