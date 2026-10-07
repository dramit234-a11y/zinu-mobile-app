import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { RequireUser } from '../components/RequireUser';
import { EmptyState, Screen, Txt } from '../components/ui';
import { api } from '../lib/api';
import { colors, spacing } from '../lib/theme';

/** In-app inbox. Every push is also stored here, so nothing is lost if push is off or not configured. */
export default function NotificationsScreen() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['notifications'], queryFn: api.notifications });
  const hasUnread = (data ?? []).some((n) => !n.readAt);

  useEffect(() => {
    if (hasUnread) api.markAllRead().then(() => qc.invalidateQueries({ queryKey: ['notifications'] }), () => {});
  }, [hasUnread, qc]);

  return (
    <RequireUser>
      <Stack.Screen options={{ headerShown: true, title: t('notifications.title'), headerTintColor: colors.primary, headerTitleStyle: { color: colors.text } }} />
      <Screen edges={['bottom']} style={{ paddingHorizontal: 0, paddingTop: 0 }}>
        {data && data.length === 0 && <EmptyState icon="notifications" title={t('notifications.empty')} body={t('notifications.emptyBody')} />}
        {(data ?? []).map((n) => (
          <View key={n.id} style={[styles.row, !n.readAt && { backgroundColor: colors.primarySoft }]} accessible accessibilityLabel={`${n.title}. ${n.body}`}>
            <Ionicons name={n.type.startsWith('document') ? 'document-text' : 'notifications'} size={22} color={colors.primary} />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Txt variant="bodyStrong">{n.title}</Txt>
              <Txt color={colors.textMuted}>{n.body}</Txt>
              <Txt variant="caption" color={colors.textMuted} style={{ marginTop: 2 }}>
                {new Date(n.createdAt).toLocaleString(i18n.language === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
              </Txt>
            </View>
          </View>
        ))}
      </Screen>
    </RequireUser>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', padding: spacing.lg, paddingHorizontal: spacing.xl, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});
