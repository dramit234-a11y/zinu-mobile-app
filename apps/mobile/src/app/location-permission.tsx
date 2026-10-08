import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Button, Screen, Txt, notify } from '../components/ui';
import { requestLocationPermission } from '../lib/location';
import { PrefKeys, prefs } from '../lib/storage';
import { colors, spacing } from '../lib/theme';

/** Spec §9: explain why before the operating system asks. */
export default function LocationPermission() {
  const { t } = useTranslation();
  const allow = async () => {
    const result = await requestLocationPermission();
    if (result !== 'granted') notify(t('ride.locTitle'), t('ride.locDenied'));
    router.back();
  };
  return (
    <Screen>
      <View style={{ alignItems: 'center', marginTop: spacing.xxl * 2 }}>
        <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="location" size={64} color={colors.primary} />
        </View>
      </View>
      <Txt variant="title" accessibilityRole="header" style={{ textAlign: 'center', marginTop: spacing.xl }}>
        {t('ride.locTitle')}
      </Txt>
      <Txt style={{ textAlign: 'center', marginTop: spacing.md, fontSize: 17, lineHeight: 24 }}>{t('ride.locBody')}</Txt>
      <Txt color={colors.textMuted} style={{ textAlign: 'center', marginTop: spacing.md }}>
        {t('ride.locDetail')}
      </Txt>
      <View style={{ flex: 1 }} />
      <Button label={t('ride.allow')} icon="navigate" onPress={allow} />
      <Button
        label={t('ride.manual')}
        variant="ghost"
        onPress={async () => {
          await prefs.set(PrefKeys.locationAsked, '1');
          router.replace('/ride/search');
        }}
        style={{ marginTop: spacing.sm }}
      />
    </Screen>
  );
}
