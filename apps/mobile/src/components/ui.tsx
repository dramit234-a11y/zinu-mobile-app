import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import i18n from '../i18n';
import { TOUCH, colors, radius, spacing, type } from '../lib/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Screen({
  children,
  scroll = true,
  edges = ['top', 'bottom'],
  style,
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView contentContainerStyle={[styles.content, style]} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.content, { flex: 1 }, style]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type Variant = keyof typeof type;
export function Txt({ variant = 'body', color = colors.text, style, ...rest }: TextProps & { variant?: Variant; color?: string }) {
  return <Text {...rest} style={[type[variant], { color }, style]} />;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const inactive = disabled || loading;
  const palette = {
    primary: { bg: colors.primary, fg: colors.textOnPrimary, border: colors.primary },
    secondary: { bg: colors.background, fg: colors.primary, border: colors.primary },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
    danger: { bg: colors.background, fg: colors.danger, border: colors.danger },
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: inactive ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.row}>
          {icon && <Ionicons name={icon} size={20} color={palette.fg} style={{ marginRight: spacing.sm }} />}
          <Text style={[type.bodyStrong, { color: palette.fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function TextField({ label, error, hint, prefix, onFocus, onBlur, ...rest }: TextInputProps & { label: string; error?: string | null; hint?: string; prefix?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Txt variant="bodyStrong" style={{ marginBottom: spacing.xs }}>
        {label}
      </Txt>
      <View style={[styles.inputWrap, focused && { borderColor: colors.primary }, error ? { borderColor: colors.danger } : null]}>
        {prefix && (
          <Txt variant="bodyStrong" style={{ marginRight: spacing.sm }}>
            {prefix}
          </Txt>
        )}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.textMuted}
          style={[type.body, styles.input]}
          onFocus={(e) => (setFocused(true), onFocus?.(e))}
          onBlur={(e) => (setFocused(false), onBlur?.(e))}
          {...rest}
        />
      </View>
      {error ? (
        <View style={[styles.row, { marginTop: spacing.xs }]} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={16} color={colors.danger} />
          <Txt variant="caption" color={colors.danger} style={{ marginLeft: spacing.xs }}>
            {error}
          </Txt>
        </View>
      ) : hint ? (
        <Txt variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Logo({ size = 96, light = false }: { size?: number; light?: boolean }) {
  return (
    <View
      accessible
      accessibilityLabel="ZINU logo"
      style={{
        width: size,
        height: size,
        borderRadius: size / 3.2,
        backgroundColor: light ? colors.background : colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: size * 0.58, fontWeight: '900', color: light ? colors.primary : colors.textOnPrimary, marginTop: -size * 0.04 }}>Z</Text>
      <View style={{ position: 'absolute', bottom: size * 0.17, width: size * 0.36, height: size * 0.07, borderRadius: 99, backgroundColor: colors.accent }} />
    </View>
  );
}

export function MenuRow({
  icon,
  label,
  onPress,
  soon,
  danger,
  value,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  soon?: boolean;
  danger?: boolean;
  value?: string;
}) {
  const color = danger ? colors.danger : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={soon ? `${label}, ${i18n.t('common.comingSoon')}` : label}
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: colors.surface }]}
    >
      <Ionicons name={icon} size={22} color={danger ? colors.danger : colors.primary} />
      <Txt style={{ flex: 1, marginLeft: spacing.md }} color={color}>
        {label}
      </Txt>
      {value ? (
        <Txt variant="caption" color={colors.textMuted} style={{ marginRight: spacing.sm }}>
          {value}
        </Txt>
      ) : null}
      {soon ? <Badge label={i18n.t('common.soon')} /> : null}
      {!danger && <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
    </Pressable>
  );
}

export function Badge({ label, tone = 'accent' }: { label: string; tone?: 'accent' | 'primary' | 'danger' }) {
  const bg = { accent: colors.accentSoft, primary: colors.primarySoft, danger: colors.dangerSoft }[tone];
  const fg = { accent: '#6B4E00', primary: colors.primaryDark, danger: colors.danger }[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2, marginRight: spacing.sm }}>
      <Txt variant="caption" color={fg} style={{ fontWeight: '600' }}>
        {label}
      </Txt>
    </View>
  );
}

export function EmptyState({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <View style={styles.empty} accessible>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={36} color={colors.primary} />
      </View>
      <Txt variant="heading" style={{ textAlign: 'center', marginTop: spacing.lg }}>
        {title}
      </Txt>
      <Txt color={colors.textMuted} style={{ textAlign: 'center', marginTop: spacing.sm }}>
        {body}
      </Txt>
    </View>
  );
}

export const showComingSoon = () => notify(i18n.t('common.comingSoon'), i18n.t('common.comingSoonBody'));

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
    backgroundColor: colors.background,
  },
  // The wrapper border shows focus; drop the browser outline in the web preview.
  input: { flex: 1, color: colors.text, paddingVertical: spacing.md, ...(Platform.OS === 'web' ? { outlineStyle: 'none' as never } : null) },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH + 8,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64, paddingHorizontal: spacing.xl },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});

/** Alert that also works in the web preview (react-native-web's Alert is a no-op). */
export function notify(title: string, body?: string) {
  if (Platform.OS === 'web') globalThis.alert?.(body ? `${title}\n\n${body}` : title);
  else Alert.alert(title, body);
}

export function confirm(title: string, body: string, confirmLabel: string, onConfirm: () => void, destructive = false) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${body}`)) onConfirm();
    return;
  }
  Alert.alert(title, body, [
    { text: i18n.t('common.cancel'), style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}
