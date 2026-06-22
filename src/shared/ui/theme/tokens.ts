// Semantic design tokens (shadcn mindset, adapted to native — see DECISIONS.md D-005).
// Components reference semantic names (primary, mutedForeground, …), never raw hex.
// Light/dark share one token shape with different values; the user picks
// light / dark / system and the choice is persisted — see ThemeProvider + useThemeMode.
//
// THEME = "Steppe Sky" (2026-06): a contemporary Kazakh-inspired palette — Kazakhstan's
// sky-blue + gold visual language, used with restraint. A warm paper-cream canvas (light)
// or a deep steppe-night navy (dark), a confident sky-blue primary (#0E5AA8 / #2B79B5),
// a gold accent reserved for streaks/rank/active ornaments (#C99412 / #E7B84B), rounded
// cards with a soft diffused lift, and pill buttons. Traditional motifs (qoshqar-muiz /
// woven band) appear ONLY in dividers, medallions, sheet handles, and active indicators —
// never as wallpaper. Body type stays system sans (full kz/ru/en glyph coverage, zero
// assets). Rebrand = edit the hex here.

import type { ViewStyle } from 'react-native';

export type ColorTokens = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  /** Tinted indigo surface for selected rows, filter chips, icon tiles. */
  primarySoft: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  success: string;
  successForeground: string;
  warning: string;
  warningForeground: string;
  /** Streak / flame accent (the "X days in a row" stat). */
  streak: string;
  streakForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  ring: string;
};

export type ThemeTokens = {
  colors: ColorTokens;
  radius: { sm: number; md: number; lg: number; xl: number; xxl: number; full: number };
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number; xxl: number };
  fontSize: { xs: number; sm: number; md: number; lg: number; xl: number; xxl: number; xxxl: number };
  /** Type faces. Both undefined = platform system sans (SF Pro / Roboto). Weight + tracking carry the style. */
  fonts: { display?: string; body?: string };
  /** Elevation presets — RN shadow style objects (iOS shadow* + Android elevation). */
  shadow: { sm: ViewStyle; md: ViewStyle; lg: ViewStyle };
  /** Minimum accessible tap target (pt). Do not go below this. */
  minTapTarget: number;
};

const radius = { sm: 10, md: 14, lg: 18, xl: 24, xxl: 30, full: 999 } as const;
const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
const fontSize = { xs: 12, sm: 13, md: 15, lg: 18, xl: 22, xxl: 30, xxxl: 40 } as const;
const minTapTarget = 44;

// System sans on both faces — native, premium, zero font assets. Swap to a display face
// (e.g. Plus Jakarta Sans / Nunito) via expo-google-fonts later if more personality is wanted.
const fonts: ThemeTokens['fonts'] = { display: undefined, body: undefined };

// Soft, diffused, navy-tinted elevation (premium steppe-sky look — never a harsh black drop shadow).
const shadow = {
  sm: { shadowColor: '#0A2540', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  md: { shadowColor: '#0A2540', shadowOpacity: 0.11, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  lg: { shadowColor: '#0A2540', shadowOpacity: 0.17, shadowRadius: 36, shadowOffset: { width: 0, height: 18 }, elevation: 12 },
} satisfies ThemeTokens['shadow'];

// "Steppe Sky" light — warm paper-cream canvas, sky-blue primary, gold accent (reserved for
// streak / rank / active ornaments). Foregrounds chosen for WCAG AA on their surfaces.
export const lightColors: ColorTokens = {
  background: '#FAF8F2', // warm paper cream (cards pop white on top)
  foreground: '#1E293B', // slate ink
  card: '#FFFFFF',
  cardForeground: '#1E293B',
  primary: '#0E5AA8', // sky blue — primary CTA + selected + accents
  primaryForeground: '#FFFFFF',
  primarySoft: '#D9EDFA', // pale sky tint (selected row / chip / icon tile bg)
  secondary: '#EBEFF4', // soft blue-gray pill (inactive chips, secondary button)
  secondaryForeground: '#1E293B',
  muted: '#EEF2F6', // segment track / inactive surface
  mutedForeground: '#5C6B7B', // AA on cream + white (captions / secondary text)
  accent: '#C99412', // gold — ornaments, rank, highlights
  accentForeground: '#1E293B', // dark ink reads on gold fills
  success: '#198754',
  successForeground: '#FFFFFF',
  warning: '#C99412', // gold doubles as warning (restrained palette)
  warningForeground: '#3A2B00',
  streak: '#C99412', // gold flame / days-in-a-row
  streakForeground: '#3A2B00',
  destructive: '#C44536', // terracotta red
  destructiveForeground: '#FFFFFF',
  border: '#D7E2EC',
  ring: '#0E5AA8',
};

// "Steppe Sky" dark — deep steppe-night navy, lifted navy cards, brighter sky-blue + gold for
// contrast. Foregrounds tuned for AA on the dark surfaces.
export const darkColors: ColorTokens = {
  background: '#0D1B2A', // steppe night
  foreground: '#F5F7FB',
  card: '#112235', // lifted navy surface
  cardForeground: '#F5F7FB',
  primary: '#2B79B5', // brighter sky blue for dark contrast
  primaryForeground: '#FFFFFF',
  primarySoft: '#17324B',
  secondary: '#1B3046',
  secondaryForeground: '#F5F7FB',
  muted: '#15293D',
  mutedForeground: '#93A6B8',
  accent: '#E7B84B', // brighter gold on dark
  accentForeground: '#1A1200',
  success: '#2FA968',
  successForeground: '#04210F',
  warning: '#E7B84B',
  warningForeground: '#201700',
  streak: '#E7B84B',
  streakForeground: '#201700',
  destructive: '#E06A5C',
  destructiveForeground: '#2A0A06',
  border: '#29435C',
  ring: '#2B79B5',
};

export const lightTheme: ThemeTokens = { colors: lightColors, radius, spacing, fontSize, fonts, shadow, minTapTarget };
export const darkTheme: ThemeTokens = { colors: darkColors, radius, spacing, fontSize, fonts, shadow, minTapTarget };
