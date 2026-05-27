// Semantic design tokens (shadcn mindset, adapted to native — see DECISIONS.md D-005).
// Components reference semantic names (primary, mutedForeground, …), never raw hex.
// Light/dark are the same token shape with different values.

export type ColorTokens = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  ring: string;
};

export type ThemeTokens = {
  colors: ColorTokens;
  radius: { sm: number; md: number; lg: number };
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number };
  fontSize: { sm: number; md: number; lg: number; xl: number };
  /** Minimum accessible tap target (pt). Do not go below this. */
  minTapTarget: number;
};

const radius = { sm: 8, md: 12, lg: 16 } as const;
const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
const fontSize = { sm: 13, md: 15, lg: 18, xl: 24 } as const;
const minTapTarget = 44;

export const lightColors: ColorTokens = {
  background: '#FFFFFF',
  foreground: '#0A0A0A',
  card: '#FFFFFF',
  cardForeground: '#0A0A0A',
  primary: '#4F46E5',
  primaryForeground: '#FFFFFF',
  secondary: '#F4F4F5',
  secondaryForeground: '#18181B',
  muted: '#F4F4F5',
  mutedForeground: '#71717A',
  accent: '#EEF2FF',
  accentForeground: '#3730A3',
  destructive: '#DC2626',
  destructiveForeground: '#FFFFFF',
  border: '#E4E4E7',
  ring: '#4F46E5',
};

export const darkColors: ColorTokens = {
  background: '#0A0A0A',
  foreground: '#FAFAFA',
  card: '#141416',
  cardForeground: '#FAFAFA',
  primary: '#6366F1',
  primaryForeground: '#FFFFFF',
  secondary: '#27272A',
  secondaryForeground: '#FAFAFA',
  muted: '#27272A',
  mutedForeground: '#A1A1AA',
  accent: '#312E81',
  accentForeground: '#E0E7FF',
  destructive: '#EF4444',
  destructiveForeground: '#FFFFFF',
  border: '#27272A',
  ring: '#6366F1',
};

export const lightTheme: ThemeTokens = { colors: lightColors, radius, spacing, fontSize, minTapTarget };
export const darkTheme: ThemeTokens = { colors: darkColors, radius, spacing, fontSize, minTapTarget };
