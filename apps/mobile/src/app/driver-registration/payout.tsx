import Ionicons from '@expo/vector-icons/Ionicons';
import { IFSC_RE, UPI_RE } from '@zinu/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { ChipSelect } from '../../components/forms';
import { Badge, Button, Card, Screen, TextField, Txt, notify } from '../../components/ui';
import { errorMessage } from '../../i18n';
import { api } from '../../lib/api';
import { useRegistration, useSetRegistration } from '../../lib/registration';
import { colors, spacing } from '../../lib/theme';

/** Spec §26 bank/UPI payout details. Sent once over TLS, encrypted at rest, never shown in full again. */
export default function PayoutStep() {
  const { t } = useTranslation();
  const { data: reg } = useRegistration();
  const setRegistration = useSetRegistration();
  const [method, setMethod] = useState<'BANK' | 'UPI'>(reg?.payout?.method ?? 'BANK');
  const [holderName, setHolderName] = useState(reg?.payout?.holderName ?? reg?.personal.fullName ?? '');
  const [account, setAccount] = useState('');
  const [confirmAccount, setConfirmAccount] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [upiId, setUpiId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const e: Record<string, string> = {};
    if (holderName.trim().length < 2) e.holderName = t('profile.nameRequired');
    if (method === 'BANK') {
      if (!/^\d{9,18}$/.test(account)) e.account = t('reg.accountNumber');
      else if (account !== confirmAccount) e.confirm = t('reg.accountMismatch');
      if (!IFSC_RE.test(ifsc.toUpperCase())) e.ifsc = t('reg.ifsc');
    } else if (!UPI_RE.test(upiId.trim())) e.upi = t('reg.upiId');
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      setRegistration(
        await api.savePayout(
          method === 'BANK'
            ? { method, holderName: holderName.trim(), accountNumber: account, ifsc: ifsc.toUpperCase() }
            : { method, holderName: holderName.trim(), upiId: upiId.trim() },
        ),
      );
      router.back();
    } catch (err) {
      notify(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      {reg?.payout && (
        <Card style={{ marginBottom: spacing.lg, flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="business" size={24} color={colors.primary} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Txt variant="bodyStrong">{reg.payout.maskedLabel}</Txt>
            <Txt variant="caption" color={colors.textMuted}>
              {reg.payout.holderName}
            </Txt>
          </View>
          <Badge label={t(`reg.payoutStatus.${reg.payout.status}`)} tone={reg.payout.status === 'VERIFIED' ? 'primary' : reg.payout.status === 'REJECTED' ? 'danger' : 'accent'} />
        </Card>
      )}
      <ChipSelect label={t('reg.payoutMethod')} options={[{ value: 'BANK', label: t('reg.bank') }, { value: 'UPI', label: t('reg.upi') }]} value={method} onChange={setMethod} />
      <TextField label={t('reg.holderName')} value={holderName} onChangeText={setHolderName} error={errors.holderName} />
      {method === 'BANK' ? (
        <>
          <TextField label={t('reg.accountNumber')} value={account} onChangeText={(v) => setAccount(v.replace(/\D/g, ''))} keyboardType="number-pad" secureTextEntry maxLength={18} error={errors.account} />
          <TextField label={t('reg.confirmAccount')} value={confirmAccount} onChangeText={(v) => setConfirmAccount(v.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={18} error={errors.confirm} />
          <TextField label={t('reg.ifsc')} value={ifsc} onChangeText={(v) => setIfsc(v.toUpperCase())} autoCapitalize="characters" maxLength={11} placeholder="SBIN0001234" error={errors.ifsc} />
        </>
      ) : (
        <TextField label={t('reg.upiId')} value={upiId} onChangeText={setUpiId} autoCapitalize="none" keyboardType="email-address" placeholder="name@okaxis" error={errors.upi} />
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg }}>
        <Ionicons name="lock-closed" size={16} color={colors.textMuted} />
        <Txt variant="caption" color={colors.textMuted} style={{ marginLeft: spacing.sm, flex: 1 }}>
          {t('reg.payoutSecure')}
        </Txt>
      </View>
      <Button label={t('common.save')} onPress={save} loading={saving} />
    </Screen>
  );
}
