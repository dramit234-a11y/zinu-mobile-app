import Ionicons from '@expo/vector-icons/Ionicons';
import { formatIndianMobile } from '@zinu/shared';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { errorMessage, LANGUAGE_OPTIONS } from '../i18n';
import { api } from '../lib/api';
import { canSwitchRoles, hasActivePassenger, hasDriverRole, useSession, type Mode } from '../lib/session';
import { PrefKeys, prefs } from '../lib/storage';
import { colors, spacing } from '../lib/theme';
import { MenuRow, Screen, Txt, confirm, notify, showComingSoon, type IconName } from './ui';

interface Item {
  icon: IconName;
  label: string;
  onPress?: () => void;
  value?: string;
}

/** Profile menus for spec §53 (passenger) and §54 (driver). Items without a handler are marked "Soon". */
export function ProfileMenu({ mode }: { mode: Mode }) {
  const { t, i18n } = useTranslation();
  const user = useSession((s) => s.user);
  if (!user) return null;

  const switchTo = async (target: Mode) => {
    await useSession.getState().setMode(target);
    router.replace(target === 'driver' ? '/driver' : '/passenger');
  };

  const logout = () =>
    confirm(t('menu.logout'), t('account.logoutConfirm'), t('menu.logout'), async () => {
      await api.logout().catch(() => {});
      useSession.getState().setUser(null);
      router.replace('/phone');
    });

  const deleteAccount = () =>
    confirm(
      t('account.deleteTitle'),
      t('account.deleteBody'),
      t('account.deleteConfirm'),
      async () => {
        try {
          await api.deleteAccount();
          await prefs.remove(PrefKeys.activeMode);
          useSession.getState().setUser(null);
          router.replace('/phone');
        } catch (e) {
          notify(errorMessage(e));
        }
      },
      true,
    );

  const languageLabel = LANGUAGE_OPTIONS.find((l) => l.code === i18n.language)?.native;
  const common = {
    personal: { icon: 'person-circle', label: t('menu.personal'), onPress: () => router.push('/settings/personal') },
    contacts: { icon: 'call', label: t('menu.emergencyContacts'), onPress: () => router.push('/settings/contacts'), value: String(user.emergencyContacts.length) },
    language: { icon: 'language', label: t('menu.language'), onPress: () => router.push('/language?from=settings'), value: languageLabel },
    safety: { icon: 'shield-checkmark', label: t('menu.safety') },
    help: { icon: 'help-buoy', label: t('menu.help') },
    privacy: { icon: 'lock-closed', label: t('menu.privacy') },
    terms: { icon: 'document-text', label: t('menu.terms') },
  } satisfies Record<string, Item>;

  const roleItems: Item[] = [];
  if (canSwitchRoles(user))
    roleItems.push(
      mode === 'passenger'
        ? { icon: 'swap-horizontal', label: t('menu.switchToDriver'), onPress: () => switchTo('driver') }
        : { icon: 'swap-horizontal', label: t('menu.switchToPassenger'), onPress: () => switchTo('passenger') },
    );
  else if (mode === 'passenger' && !hasDriverRole(user))
    roleItems.push({ icon: 'speedometer', label: t('menu.driveWithZinu'), onPress: () => router.push('/driver-intro') });
  else if (mode === 'passenger' && hasDriverRole(user))
    roleItems.push({ icon: 'speedometer', label: t('menu.driverApplication'), onPress: () => switchTo('driver'), value: t(`driver.status.${user.driver?.verificationStatus ?? 'NOT_SUBMITTED'}`) });
  else if (mode === 'driver' && !hasActivePassenger(user))
    roleItems.push({ icon: 'navigate', label: t('menu.bookRides'), onPress: () => router.push('/passenger-profile') });
  else if (mode === 'driver' && hasActivePassenger(user))
    roleItems.push({ icon: 'swap-horizontal', label: t('menu.switchToPassenger'), onPress: () => switchTo('passenger') });

  const items: Item[] =
    mode === 'passenger'
      ? [
          common.personal,
          { icon: 'bookmark', label: t('menu.savedPlaces') },
          { icon: 'heart', label: t('menu.myDrivers') },
          common.contacts,
          { icon: 'wallet', label: t('menu.wallet') },
          { icon: 'card', label: t('menu.paymentMethods') },
          { icon: 'pricetags', label: t('menu.offers') },
          { icon: 'notifications', label: t('menu.notifications') },
          common.language,
          common.safety,
          common.help,
          common.privacy,
          common.terms,
        ]
      : [
          common.personal,
          { icon: 'car', label: t('menu.vehicle') },
          { icon: 'documents', label: t('menu.documents') },
          { icon: 'business', label: t('menu.payout') },
          { icon: 'star', label: t('menu.ratings') },
          { icon: 'map', label: t('menu.preferredAreas') },
          { icon: 'flag', label: t('menu.dailyGoal') },
          { icon: 'ribbon', label: t('menu.subscription') },
          { icon: 'flash', label: t('menu.zinuVehicle') },
          common.contacts,
          common.safety,
          common.help,
          common.language,
          common.privacy,
          common.terms,
        ];

  return (
    <Screen edges={['top']} style={{ paddingHorizontal: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, marginBottom: spacing.xl }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="person" size={32} color={colors.primary} />
        </View>
        <View style={{ marginLeft: spacing.lg, flex: 1 }}>
          <Txt variant="heading">{user.fullName ?? '—'}</Txt>
          <Txt color={colors.textMuted}>{user.phone ? formatIndianMobile(user.phone) : ''}</Txt>
        </View>
      </View>
      {[...roleItems, ...items].map((item) => (
        <MenuRow key={item.label} icon={item.icon} label={item.label} value={item.value} onPress={item.onPress ?? showComingSoon} soon={!item.onPress} />
      ))}
      <MenuRow icon="log-out" label={t('menu.logout')} onPress={logout} />
      <MenuRow icon="trash" label={t('menu.deleteAccount')} onPress={deleteAccount} danger />
      <Txt variant="caption" color={colors.textMuted} style={{ textAlign: 'center', marginTop: spacing.xl }}>
        ZINU · {t('brand.tagline')}
      </Txt>
    </Screen>
  );
}
