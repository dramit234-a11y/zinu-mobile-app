import { LANGUAGES, normalizeIndianMobile, type Language } from '@zinu/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Screen, TextField, Txt, notify } from '../components/ui';
import i18n, { LANGUAGE_OPTIONS, errorMessage, setLanguage } from '../i18n';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { colors, radius, spacing } from '../lib/theme';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Spec §8: only what is needed — name, optional email, language, emergency contact. */
export default function PassengerProfile() {
  const { t } = useTranslation();
  const user = useSession((s) => s.user);
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [language, setLang] = useState<Language>((LANGUAGES as string[]).includes(i18n.language) ? (i18n.language as Language) : 'en');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [relation, setRelation] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const e: Record<string, string> = {};
    if (fullName.trim().length < 2) e.fullName = t('profile.nameRequired');
    if (email && !EMAIL.test(email.trim())) e.email = t('profile.emailInvalid');
    const wantsContact = contactName.trim() || contactPhone.trim();
    const contactE164 = normalizeIndianMobile(contactPhone);
    if (wantsContact && contactName.trim().length < 2) e.contactName = t('profile.nameRequired');
    if (wantsContact && !contactE164) e.contactPhone = t('auth.phoneInvalid');
    setErrors(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    try {
      const me = await api.completePassengerProfile({
        fullName: fullName.trim(),
        email: email.trim(),
        language,
        emergencyContact: wantsContact ? { name: contactName.trim(), phone: contactE164!, relation: relation.trim() || undefined } : undefined,
      });
      await setLanguage(language);
      useSession.getState().setUser(me);
      await useSession.getState().setMode('passenger');
      router.replace('/passenger');
    } catch (err) {
      notify(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Txt variant="title" accessibilityRole="header" style={{ marginTop: spacing.lg, marginBottom: spacing.xl }}>
        {t('profile.completeTitle')}
      </Txt>
      <TextField label={t('profile.fullName')} value={fullName} onChangeText={setFullName} autoComplete="name" textContentType="name" error={errors.fullName} />
      <TextField
        label={`${t('profile.email')} (${t('common.optional')})`}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        error={errors.email}
      />

      <Txt variant="bodyStrong" style={{ marginBottom: spacing.sm }}>
        {t('profile.language')}
      </Txt>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {LANGUAGE_OPTIONS.map((o) => (
          <Pressable
            key={o.code}
            accessibilityRole="radio"
            accessibilityState={{ checked: language === o.code }}
            onPress={() => setLang(o.code)}
            style={[styles.chip, language === o.code && styles.chipActive]}
          >
            <Txt variant="bodyStrong" color={language === o.code ? colors.primaryDark : colors.text}>
              {o.native}
            </Txt>
          </Pressable>
        ))}
      </View>

      <Txt variant="heading" style={{ marginTop: spacing.lg }}>
        {t('profile.emergencyContact')} ({t('common.optional')})
      </Txt>
      <Txt variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs, marginBottom: spacing.md }}>
        {t('profile.emergencyHint')}
      </Txt>
      <TextField label={t('profile.contactName')} value={contactName} onChangeText={setContactName} error={errors.contactName} />
      <TextField label={t('profile.contactPhone')} prefix="+91" value={contactPhone} onChangeText={setContactPhone} keyboardType="phone-pad" maxLength={11} error={errors.contactPhone} />
      <TextField label={t('profile.relation')} value={relation} onChangeText={setRelation} />

      <Button label={t('common.continue')} onPress={submit} loading={saving} style={{ marginTop: spacing.md }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  chip: { minHeight: 48, paddingHorizontal: spacing.xl, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.border, justifyContent: 'center' },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
});
