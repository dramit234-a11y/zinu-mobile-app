import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Screen, Txt, confirm, notify, type IconName } from '../../components/ui';
import { errorMessage } from '../../i18n';
import { api } from '../../lib/api';
import { colors, spacing } from '../../lib/theme';

/** Spec §53 Saved Places: Home, Work and other favourites. */
export default function SavedPlaces() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['saved-places'], queryFn: api.savedPlaces });
  const home = data?.find((p) => p.label === 'HOME');
  const work = data?.find((p) => p.label === 'WORK');
  const others = data?.filter((p) => p.label === 'OTHER') ?? [];

  const set = (label: 'HOME' | 'WORK' | 'OTHER') => router.push({ pathname: '/ride/search', params: { mode: 'save', label } });
  const remove = (id: string, name: string) =>
    confirm(t('ride.remove'), name, t('ride.remove'), async () => {
      try {
        qc.setQueryData(['saved-places'], await api.deletePlace(id));
      } catch (e) {
        notify(errorMessage(e));
      }
    }, true);

  const Row = ({ icon, title, address, onEdit, onRemove }: { icon: IconName; title: string; address?: string; onEdit: () => void; onRemove?: () => void }) => (
    <View style={styles.row}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      <Pressable accessibilityRole="button" onPress={onEdit} style={{ flex: 1, marginLeft: spacing.md }}>
        <Txt variant="bodyStrong">{title}</Txt>
        <Txt variant="caption" color={address ? colors.textMuted : colors.primary} numberOfLines={2}>
          {address ?? t('ride.change')}
        </Txt>
      </Pressable>
      {onRemove && (
        <Pressable accessibilityRole="button" accessibilityLabel={`${t('ride.remove')} ${title}`} onPress={onRemove} style={{ padding: spacing.md }}>
          <Ionicons name="trash-outline" size={20} color={colors.danger} />
        </Pressable>
      )}
    </View>
  );

  return (
    <Screen edges={['bottom']} style={{ paddingHorizontal: 0 }}>
      <Row icon="home" title={home ? t('ride.labels.HOME') : t('ride.setHome')} address={home?.address} onEdit={() => set('HOME')} onRemove={home ? () => remove(home.id, home.address) : undefined} />
      <Row icon="briefcase" title={work ? t('ride.labels.WORK') : t('ride.setWork')} address={work?.address} onEdit={() => set('WORK')} onRemove={work ? () => remove(work.id, work.address) : undefined} />
      {others.map((p) => (
        <Row key={p.id} icon="bookmark" title={p.name ?? t('ride.labels.OTHER')} address={p.address} onEdit={() => set('OTHER')} onRemove={() => remove(p.id, p.address)} />
      ))}
      <View style={{ padding: spacing.xl }}>
        <Button label={t('ride.addPlace')} icon="add" variant="secondary" onPress={() => set('OTHER')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 72, paddingHorizontal: spacing.xl, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});
