import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { DocBadge } from '../../components/DocBadge';
import { isoToDmy } from '../../components/forms';
import { Screen, Txt } from '../../components/ui';
import { useRegistration } from '../../lib/registration';
import { colors, spacing } from '../../lib/theme';

/** Every document that applies to this driver's vehicle, with its review status (spec §26–27, §41). */
export default function DocumentsStep() {
  const { t } = useTranslation();
  const { data: reg } = useRegistration();
  if (!reg) return null;
  return (
    <Screen edges={['bottom']} style={{ paddingHorizontal: 0 }}>
      {reg.documents.map((e) => {
        const shown = e.current ?? e.inForce;
        return (
          <Pressable
            key={e.type.code}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/driver-registration/document', params: { type: e.type.code } })}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}
          >
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong">
                {e.type.label}
                {!e.type.required ? ` (${t('reg.optionalDoc')})` : ''}
              </Txt>
              {shown?.expiresOn ? (
                <Txt variant="caption" color={colors.textMuted}>
                  {t('reg.expiresOn', { date: isoToDmy(shown.expiresOn) })}
                </Txt>
              ) : null}
              {e.current?.status === 'REJECTED' && e.current.rejectionReason ? (
                <Txt variant="caption" color={colors.danger}>
                  {e.current.rejectionReason}
                </Txt>
              ) : null}
            </View>
            <DocBadge entry={e} />
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
