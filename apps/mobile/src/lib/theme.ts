/** ZINU design tokens. Text/background pairs meet WCAG AA contrast (≥4.5:1). */
export const colors = {
  primary: '#0E7A55',
  primaryDark: '#0A5C40',
  primarySoft: '#E3F2EC',
  accent: '#F5B700',
  accentSoft: '#FFF6D6',
  text: '#10231C',
  textMuted: '#4F5F5A',
  textOnPrimary: '#FFFFFF',
  background: '#FFFFFF',
  surface: '#F3F7F5',
  border: '#D5DFDB',
  danger: '#B3261E',
  dangerSoft: '#FCEBEA',
  success: '#1B7F3B',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };

/** Minimum touch target (Android 48dp, iOS 44pt). */
export const TOUCH = 48;

export const type = {
  display: { fontSize: 34, fontWeight: '800' as const, letterSpacing: 1 },
  title: { fontSize: 26, fontWeight: '700' as const },
  heading: { fontSize: 19, fontWeight: '700' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  bodyStrong: { fontSize: 16, fontWeight: '600' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
};
