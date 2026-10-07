import Ionicons from '@expo/vector-icons/Ionicons';
import type { Language } from '@zinu/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Logo, Screen, Txt, notify } from '../components/ui';
import i18n, { LANGUAGE_OPTIONS, deviceLanguage, errorMessage, setLanguage } from '../i18n';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { colors, radius, spacing } from '../lib/theme';

/** Spec §5. Used on first launch and from Settings (?from=settings). */
export default function LanguageScreen() {
  const { t } = useTranslation();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const fromSettings = from === 'settings';
  const [selected, setSelected] = useState<Language>((i18n.language as Language) || deviceLanguage());
  const [saving, setSaving] = useState(false);

  const onContinue = async () => {
    setSaving(true);
    try {
      await setLanguage(selected);
      const user = useSession.getState().user;
      if (user && user.language !== selected) useSession.getState().setUser(await api.updateMe({ language: selected }));
      if (fromSettings) router.back();
      else router.replace('/onboarding');
    } catch (e) {
      notify(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      {!fromSettings && (
        <View style={{ alignItems: 'center', marginTop: spacing.xxl, marginBottom: spacing.xl }}>
          <Logo size={72} />
        </View>
      )}
      <Txt variant="title" accessibilityRole="header">
        {t('language.title')}
      </Txt>
      <Txt color={colors.textMuted} style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>
        {t('language.subtitle')}
      </Txt>
      <View accessibilityRole="radiogroup">
        {LANGUAGE_OPTIONS.map((opt) => {
          const active = opt.code === selected;
          return (
            <Pressable
              key={opt.code}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={`${opt.native} (${opt.label})`}
              onPress={() => setSelected(opt.code)}
              style={[styles.option, active && styles.optionActive]}
            >
              <View style={{ flex: 1 }}>
                <Txt variant="heading">{opt.native}</Txt>
                {opt.native !== opt.label && <Txt color={colors.textMuted}>{opt.label}</Txt>}
              </View>
              <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={26} color={active ? colors.primary : colors.textMuted} />
            </Pressable>
          );
        })}
      </View>
      <View style={{ flex: 1 }} />
      <Button label={t('common.continue')} onPress={onContinue} loading={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    minHeight: 72,
    marginBottom: spacing.md,
  },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
});
