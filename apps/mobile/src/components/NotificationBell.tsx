import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../lib/api';
import { colors } from '../lib/theme';

export function NotificationBell() {
  const { t } = useTranslation();
  const { data, refetch } = useQuery({ queryKey: ['notifications'], queryFn: api.notifications });
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );
  const unread = (data ?? []).filter((n) => !n.readAt).length;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread ? `${t('notifications.title')}, ${unread}` : t('notifications.title')}
      onPress={() => router.push('/notifications')}
      style={styles.button}
    >
      <Ionicons name="notifications-outline" size={26} color={colors.text} />
      {unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 6, right: 4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
