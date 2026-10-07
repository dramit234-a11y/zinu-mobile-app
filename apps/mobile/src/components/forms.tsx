import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../lib/theme';
import { TextField, Txt } from './ui';

export function ChipSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label: string;
  options: { value: T; label: string; disabled?: boolean }[];
  value: T | null;
  onChange: (v: T) => void;
  error?: string | null;
}) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Txt variant="bodyStrong" style={{ marginBottom: spacing.sm }}>
        {label}
      </Txt>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: active, disabled: o.disabled }}
              disabled={o.disabled}
              onPress={() => onChange(o.value)}
              style={[styles.chip, active && styles.chipActive, o.disabled && { opacity: 0.4 }]}
            >
              <Txt variant="bodyStrong" color={active ? colors.primaryDark : colors.text}>
                {o.label}
              </Txt>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <Txt variant="caption" color={colors.danger} style={{ marginTop: spacing.xs }}>
          {error}
        </Txt>
      ) : null}
    </View>
  );
}

/** "2026-10-07" -> "07/10/2026" */
export const isoToDmy = (iso: string | null | undefined) => (iso ? iso.split('-').reverse().join('/') : '');

/** "07/10/2026" -> "2026-10-07", or null if it is not a real date. */
export function dmyToIso(dmy: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dmy);
  if (!m) return null;
  const [, d, mo, y] = m;
  const iso = `${y}-${mo}-${d}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(iso) ? iso : null;
}

/** Numeric date entry that formats as DD/MM/YYYY while typing (no native picker needed). */
export function DateField({ label, value, onChange, error }: { label: string; value: string; onChange: (v: string) => void; error?: string | null }) {
  const format = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('/');
  };
  return (
    <TextField
      label={label}
      value={value}
      onChangeText={(v) => onChange(format(v))}
      keyboardType="number-pad"
      placeholder="DD/MM/YYYY"
      maxLength={10}
      error={error}
    />
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minHeight: 48, paddingHorizontal: spacing.lg, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.border, justifyContent: 'center' },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
});
