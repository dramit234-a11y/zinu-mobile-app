import { normalizeIndianMobile } from '@zinu/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Button, Logo, Screen, TextField, Txt } from '../components/ui';
import { errorMessage } from '../i18n';
import { ApiError, api } from '../lib/api';
import { colors, spacing } from '../lib/theme';

/** Spec §6: mobile number → Continue → OTP. */
export default function PhoneScreen() {
  const { t } = useTranslation();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const digits = phone.replace(/\D/g, '');

  const onContinue = async () => {
    const e164 = normalizeIndianMobile(digits);
    if (!e164) return setError(t('auth.phoneInvalid'));
    setError(null);
    setLoading(true);
    try {
      const res = await api.requestOtp(e164);
      router.push({ pathname: '/otp', params: { phone: e164, resendAfter: String(res.resendAfterSec), devCode: res.devCode ?? '' } });
    } catch (e) {
      // A code was sent moments ago and is still valid: continue to the OTP screen with the remaining cooldown.
      if (e instanceof ApiError && e.code === 'OTP_RESEND_TOO_SOON') {
        const retry = (e.details as { retryAfterSec?: number } | undefined)?.retryAfterSec ?? 30;
        router.push({ pathname: '/otp', params: { phone: e164, resendAfter: String(retry), devCode: '' } });
      } else setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={{ marginTop: spacing.xl, marginBottom: spacing.xxl }}>
        <Logo size={56} />
      </View>
      <Txt variant="title" accessibilityRole="header">
        {t('auth.phoneTitle')}
      </Txt>
      <Txt color={colors.textMuted} style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>
        {t('auth.phoneSubtitle')}
      </Txt>
      <TextField
        label={t('auth.phoneLabel')}
        prefix="+91"
        value={phone}
        onChangeText={(v) => {
          setPhone(v.replace(/[^\d ]/g, ''));
          setError(null);
        }}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        maxLength={11}
        placeholder="98765 43210"
        error={error}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={onContinue}
      />
      <View style={{ flex: 1 }} />
      <Txt variant="caption" color={colors.textMuted} style={{ textAlign: 'center', marginBottom: spacing.md }}>
        {t('auth.terms')}
      </Txt>
      <Button label={t('common.continue')} onPress={onContinue} loading={loading} disabled={digits.length < 10} />
    </Screen>
  );
}
