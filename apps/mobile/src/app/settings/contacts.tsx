import Ionicons from '@expo/vector-icons/Ionicons';
import { formatIndianMobile, normalizeIndianMobile } from '@zinu/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { Button, Card, Screen, TextField, Txt, notify } from '../../components/ui';
import { errorMessage } from '../../i18n';
import { api } from '../../lib/api';
import { useSession } from '../../lib/session';
import { colors, spacing } from '../../lib/theme';

const MAX_CONTACTS = 5;

/** Emergency contacts used by SOS and Share Trip (spec §42–44). */
export default function EmergencyContacts() {
  const { t } = useTranslation();
  const user = useSession((s) => s.user);
  const contacts = user?.emergencyContacts ?? [];
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relation, setRelation] = useState('');
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [busy, setBusy] = useState(false);

  const save = async (next: { name: string; phone: string; relation?: string }[]) => {
    setBusy(true);
    try {
      useSession.getState().setUser(await api.replaceEmergencyContacts(next));
      return true;
    } catch (e) {
      notify(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    const e164 = normalizeIndianMobile(phone);
    const e: typeof errors = {};
    if (name.trim().length < 2) e.name = t('profile.nameRequired');
    if (!e164) e.phone = t('auth.phoneInvalid');
    setErrors(e);
    if (Object.keys(e).length) return;
    const existing = contacts.map(({ name, phone, relation }) => ({ name, phone, relation }));
    if (await save([...existing, { name: name.trim(), phone: e164!, relation: relation.trim() || undefined }])) {
      setName('');
      setPhone('');
      setRelation('');
    }
  };

  const remove = (id: string) => save(contacts.filter((c) => c.id !== id).map(({ name, phone, relation }) => ({ name, phone, relation })));

  return (
    <Screen edges={['bottom']}>
      <Txt color={colors.textMuted} style={{ marginBottom: spacing.lg }}>
        {t('profile.emergencyHint')}
      </Txt>
      {contacts.length === 0 && <Txt style={{ marginBottom: spacing.lg }}>{t('contacts.empty')}</Txt>}
      {contacts.map((c) => (
        <Card key={c.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
          <Ionicons name="person-circle" size={36} color={colors.primary} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Txt variant="bodyStrong">
              {c.name}
              {c.relation ? ` · ${c.relation}` : ''}
            </Txt>
            <Txt color={colors.textMuted}>{formatIndianMobile(c.phone)}</Txt>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`${t('contacts.remove')} ${c.name}`} onPress={() => remove(c.id)} style={{ padding: spacing.md }} disabled={busy}>
            <Ionicons name="trash-outline" size={22} color={colors.danger} />
          </Pressable>
        </Card>
      ))}

      {contacts.length < MAX_CONTACTS && (
        <View style={{ marginTop: spacing.lg }}>
          <Txt variant="heading" style={{ marginBottom: spacing.md }}>
            {t('contacts.add')}
          </Txt>
          <TextField label={t('profile.contactName')} value={name} onChangeText={setName} error={errors.name} />
          <TextField label={t('profile.contactPhone')} prefix="+91" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={11} error={errors.phone} />
          <TextField label={t('profile.relation')} value={relation} onChangeText={setRelation} />
          <Button label={t('contacts.add')} icon="add" onPress={add} loading={busy} />
        </View>
      )}
    </Screen>
  );
}
