import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { Screen, Txt, type IconName } from '../components/ui';
import { hasActivePassenger, useSession } from '../lib/session';
import { colors, radius, spacing } from '../lib/theme';

/** Spec §7: choose how to use ZINU. The other role can be activated later. */
export default function AccountType() {
  const { t } = useTranslation();
  const user = useSession((s) => s.user);

  const ride = () => {
    if (hasActivePassenger(user)) router.replace('/passenger');
    else router.push('/passenger-profile');
  };

  return (
    <Screen>
      <Txt variant="title" accessibilityRole="header" style={{ marginTop: spacing.xl, marginBottom: spacing.xl }}>
        {t('accountType.title')}
      </Txt>
      <Choice icon="navigate" title={t('accountType.rideTitle')} body={t('accountType.rideBody')} onPress={ride} />
      <Choice icon="speedometer" title={t('accountType.driveTitle')} body={t('accountType.driveBody')} onPress={() => router.push('/driver-intro')} accent />
      <Txt variant="caption" color={colors.textMuted} style={{ textAlign: 'center', marginTop: spacing.lg }}>
        {t('accountType.later')}
      </Txt>
    </Screen>
  );
}

function Choice({ icon, title, body, onPress, accent }: { icon: IconName; title: string; body: string; onPress: () => void; accent?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, accent && { backgroundColor: colors.accentSoft }, pressed && { opacity: 0.85 }]}
    >
      <View style={[styles.icon, accent && { backgroundColor: colors.accent }]}>
        <Ionicons name={icon} size={36} color={accent ? colors.text : colors.textOnPrimary} />
      </View>
      <View style={{ flex: 1, marginLeft: spacing.lg }}>
        <Txt variant="heading">{title}</Txt>
        <Txt color={colors.textMuted} style={{ marginTop: spacing.xs }}>
          {body}
        </Txt>
      </View>
      <Ionicons name="chevron-forward" size={24} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.xl,
    padding: spacing.xl,
    minHeight: 140,
    marginBottom: spacing.lg,
  },
  icon: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
