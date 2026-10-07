import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChipSelect, DateField, dmyToIso, isoToDmy } from '../../components/forms';
import { Button, Screen, TextField, notify } from '../../components/ui';
import { errorMessage } from '../../i18n';
import { api } from '../../lib/api';
import { useRegistration, useSetRegistration } from '../../lib/registration';
import { useSession } from '../../lib/session';
import { spacing } from '../../lib/theme';

export default function PersonalStep() {
  const { t } = useTranslation();
  const { data: reg } = useRegistration();
  const setRegistration = useSetRegistration();
  const cities = useQuery({ queryKey: ['cities'], queryFn: api.cities });
  const [fullName, setFullName] = useState(reg?.personal.fullName ?? useSession.getState().user?.fullName ?? '');
  const [dob, setDob] = useState(isoToDmy(reg?.personal.dateOfBirth));
  const [address, setAddress] = useState(reg?.personal.address ?? '');
  const [cityId, setCityId] = useState<string | null>(reg?.personal.cityId ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const e: Record<string, string> = {};
    const iso = dmyToIso(dob);
    if (fullName.trim().length < 2) e.fullName = t('profile.nameRequired');
    if (!iso) e.dob = t('reg.dobInvalid');
    if (address.trim().length < 10) e.address = t('reg.addressInvalid');
    if (!cityId) e.city = t('reg.city');
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      setRegistration(await api.savePersonal({ fullName: fullName.trim(), dateOfBirth: iso!, address: address.trim(), cityId: cityId! }));
      const user = useSession.getState().user;
      if (user) useSession.getState().setUser({ ...user, fullName: fullName.trim() });
      router.back();
    } catch (err) {
      notify(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <TextField label={t('profile.fullName')} value={fullName} onChangeText={setFullName} autoComplete="name" error={errors.fullName} hint={t('reg.nameHint')} />
      <DateField label={t('reg.dob')} value={dob} onChange={setDob} error={errors.dob} />
      <TextField label={t('reg.address')} value={address} onChangeText={setAddress} multiline numberOfLines={3} autoComplete="street-address" error={errors.address} />
      <ChipSelect label={t('reg.city')} options={(cities.data ?? []).map((c) => ({ value: c.id, label: c.name }))} value={cityId} onChange={setCityId} error={errors.city} />
      <Button label={t('common.save')} onPress={save} loading={saving} style={{ marginTop: spacing.md }} />
    </Screen>
  );
}
