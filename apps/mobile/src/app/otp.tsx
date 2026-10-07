import { formatIndianMobile } from '@zinu/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Badge, Button, Screen, Txt } from '../components/ui';
import { errorMessage } from '../i18n';
import { api } from '../lib/api';
import { homeRoute, useSession, type Mode } from '../lib/session';
import { PrefKeys, prefs } from '../lib/storage';
import { colors, radius, spacing, type } from '../lib/theme';

const LENGTH = 6;

/** Spec §6: 6-digit OTP with Verify and Resend (cooldown). New users continue to profile setup. */
export default function OtpScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ phone: string; resendAfter?: string; devCode?: string }>();
  const phone = params.phone ?? '';
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState(params.devCode || '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(Number(params.resendAfter ?? 30));
  const input = useRef<TextInput>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const verify = async (value = code) => {
    if (value.length !== LENGTH || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.verifyOtp(phone, value);
      const mode = ((await prefs.get(PrefKeys.activeMode)) as Mode | null) ?? 'passenger';
      useSession.setState({ user: res.user, mode });
      router.replace(res.user.profileComplete ? homeRoute(res.user, mode) : '/account-type');
    } catch (e) {
      setError(errorMessage(e));
      setCode('');
      input.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError(null);
    try {
      const res = await api.requestOtp(phone);
      setCooldown(res.resendAfterSec);
      setDevCode(res.devCode ?? '');
      setCode('');
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <Screen>
      <Txt variant="title" accessibilityRole="header" style={{ marginTop: spacing.xl }}>
        {t('auth.otpTitle')}
      </Txt>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: spacing.sm }}>
        <Txt color={colors.textMuted}>{t('auth.otpSubtitle', { phone: phone ? formatIndianMobile(phone) : '' })} </Txt>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <Txt variant="bodyStrong" color={colors.primary}>
            {t('auth.changeNumber')}
          </Txt>
        </Pressable>
      </View>

      {devCode ? (
        <View style={{ marginTop: spacing.lg, alignSelf: 'flex-start' }}>
          <Badge label={t('auth.devCode', { code: devCode })} tone="primary" />
        </View>
      ) : null}

      <Pressable onPress={() => input.current?.focus()} style={styles.boxes} accessible={false}>
        {Array.from({ length: LENGTH }).map((_, i) => {
          const filled = i < code.length;
          const focused = i === code.length;
          return (
            <View key={i} style={[styles.box, focused && styles.boxFocused, error && styles.boxError]}>
              <Txt style={[type.title, { color: colors.text }]}>{filled ? code[i] : ''}</Txt>
            </View>
          );
        })}
      </Pressable>
      <TextInput
        ref={input}
        value={code}
        onChangeText={(v) => {
          const next = v.replace(/\D/g, '').slice(0, LENGTH);
          setCode(next);
          setError(null);
          if (next.length === LENGTH) verify(next);
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={LENGTH}
        autoFocus
        accessibilityLabel={t('auth.otpTitle')}
        style={styles.hiddenInput}
      />
      {error ? (
        <Txt color={colors.danger} accessibilityLiveRegion="polite" style={{ marginTop: spacing.md }}>
          {error}
        </Txt>
      ) : null}

      <View style={{ marginTop: spacing.xl }}>
        {cooldown > 0 ? (
          <Txt color={colors.textMuted}>{t('auth.resendIn', { seconds: cooldown })}</Txt>
        ) : (
          <Button label={t('auth.resend')} onPress={resend} variant="ghost" style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />
        )}
      </View>
      <View style={{ flex: 1 }} />
      <Button label={t('auth.verify')} onPress={() => verify()} loading={loading} disabled={code.length !== LENGTH} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  boxes: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xl, gap: spacing.sm },
  box: {
    flex: 1,
    maxWidth: 52,
    height: 60,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFocused: { borderColor: colors.primary },
  boxError: { borderColor: colors.danger },
  hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1 },
});
