import { formatIndianMobile } from '@zinu/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Screen, TextField, notify } from '../../components/ui';
import { errorMessage } from '../../i18n';
import { api } from '../../lib/api';
import { useSession } from '../../lib/session';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function PersonalDetails() {
  const { t } = useTranslation();
  const user = useSession((s) => s.user);
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [errors, setErrors] = useState<{ fullName?: string; email?: string }>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const e: typeof errors = {};
    if (fullName.trim().length < 2) e.fullName = t('profile.nameRequired');
    if (email.trim() && !EMAIL.test(email.trim())) e.email = t('profile.emailInvalid');
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      useSession.getState().setUser(await api.updateMe({ fullName: fullName.trim(), email: email.trim() }));
      router.back();
    } catch (err) {
      notify(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <TextField label={t('auth.phoneLabel')} value={user?.phone ? formatIndianMobile(user.phone) : ''} editable={false} />
      <TextField label={t('profile.fullName')} value={fullName} onChangeText={setFullName} error={errors.fullName} autoComplete="name" />
      <TextField
        label={`${t('profile.email')} (${t('common.optional')})`}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        error={errors.email}
      />
      <Button label={t('common.save')} onPress={save} loading={saving} />
    </Screen>
  );
}
