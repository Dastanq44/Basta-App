// Semantic design tokens (shadcn mindset, adapted to native — see DECISIONS.md D-005).
// Components reference semantic names (primary, mutedForeground, …), never raw hex.
// Light/dark share one token shape with different values; the user picks
// light / dark / system and the choice is persisted — see ThemeProvider + useThemeMode.
//
// THEME = "Sleek indigo" (2026-06, from a user-supplied reference): friendly geometric
// SANS (system font, zero assets), a vivid indigo accent (#4F46E5) on a soft off-white
// canvas (light) or a deep indigo-navy canvas (dark), rounded cards with a soft diffused
// lift, fully-rounded pill buttons, and warm stat accents (orange streak, green done,
// gold rank). Rebrand = edit the hex here.

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

// Soft, diffused, slightly indigo-tinted elevation (premium look — never a harsh black drop shadow).
const shadow = {
  sm: { shadowColor: '#1E1B4B', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  md: { shadowColor: '#1E1B4B', shadowOpacity: 0.1, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  lg: { shadowColor: '#1E1B4B', shadowOpacity: 0.16, shadowRadius: 36, shadowOffset: { width: 0, height: 18 }, elevation: 12 },
} satisfies ThemeTokens['shadow'];

export const lightColors: ColorTokens = {
  background: '#F4F5F8', // soft off-white page (cards pop white on top)
  foreground: '#16161E', // near-black ink
  card: '#FFFFFF',
  cardForeground: '#16161E',
  primary: '#4F46E5', // vivid indigo — primary CTA + selected + accents
  primaryForeground: '#FFFFFF',
  primarySoft: '#E0E7FF', // indigo tint (selected row / chip / icon tile bg)
  secondary: '#EEEEF3', // soft gray pill (inactive chips, secondary button)
  secondaryForeground: '#16161E',
  muted: '#EFEFF4',
  mutedForeground: '#85858F',
  accent: '#4F46E5',
  accentForeground: '#FFFFFF',
  success: '#22C55E',
  successForeground: '#FFFFFF',
  warning: '#F5A623', // gold (rank / trophy)
  warningForeground: '#FFFFFF',
  streak: '#FF7A1A', // orange (flame / days-in-a-row)
  streakForeground: '#FFFFFF',
  destructive: '#FF3B30',
  destructiveForeground: '#FFFFFF',
  border: '#E7E7EE',
  ring: '#4F46E5',
};

export const darkColors: ColorTokens = {
  background: '#131120', // deep indigo-navy (not pure black — matches the reference)
  foreground: '#F3F2FA',
  card: '#1E1B2D', // slightly lifted navy-indigo surface
  cardForeground: '#F3F2FA',
  primary: '#6366F1', // brighter indigo for contrast on dark
  primaryForeground: '#FFFFFF',
  primarySoft: '#262B4D',
  secondary: '#272335',
  secondaryForeground: '#F3F2FA',
  muted: '#221F31',
  mutedForeground: '#9A96AD',
  accent: '#6366F1',
  accentForeground: '#FFFFFF',
  success: '#34D27B',
  successForeground: '#06230F',
  warning: '#F5B027',
  warningForeground: '#211603',
  streak: '#FF8A42',
  streakForeground: '#2A1402',
  destructive: '#FF453A',
  destructiveForeground: '#FFFFFF',
  border: '#2C2841',
  ring: '#6366F1',
};

export const lightTheme: ThemeTokens = { colors: lightColors, radius, spacing, fontSize, fonts, shadow, minTapTarget };
export const darkTheme: ThemeTokens = { colors: darkColors, radius, spacing, fontSize, fonts, shadow, minTapTarget };
