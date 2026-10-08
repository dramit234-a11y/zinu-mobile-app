import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSession } from '../lib/session';
import { colors, radius, spacing } from '../lib/theme';
import { Txt } from './ui';

/** Shown whenever the API runs without a Google Maps key, so demonstration data is never mistaken for real. */
export function DemoBanner({ provider }: { provider?: string }) {
  const { t } = useTranslation();
  const configured = useSession((s) => s.mapsProvider);
  if ((provider ?? configured) !== 'demo') return null;
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Ionicons name="flask" size={16} color="#6B4E00" />
      <Txt variant="caption" color="#6B4E00" style={{ flex: 1, marginLeft: spacing.sm, fontWeight: '600' }}>
        {t('ride.demoBanner')}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: spacing.sm, paddingHorizontal: spacing.md },
});
