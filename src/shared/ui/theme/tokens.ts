// Semantic design tokens (shadcn mindset, adapted to native — see DECISIONS.md D-005).
// Components reference semantic names (primary, mutedForeground, …), never raw hex.
// Light/dark are the same token shape with different values.
//
// THEME = Retro.app-inspired editorial minimal (user reference, 2026-05-31):
//   crisp white, near-black ink, a bold SERIF display face for titles/headings, sans body,
//   OUTLINED pill buttons (secondary), soft gray rounded tiles, ONE bright blue accent
//   (avatars / links / selected / "pending"), and red for destructive/notifications.
// Rebrand = edit the hex here. NOTE: the serif is the platform serif (Georgia/serif), zero-dep;
// swap to an exact display face (e.g. Instrument Serif / Playfair) via expo-google-fonts later.

import { Platform } from 'react-native';
import type { ViewStyle } from 'react-native';

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
  success: string;
  successForeground: string;
  warning: string;
  warningForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  ring: string;
};

export type ThemeTokens = {
  colors: ColorTokens;
  radius: { sm: number; md: number; lg: number; xl: number; full: number };
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number; xxl: number };
  fontSize: { xs: number; sm: number; md: number; lg: number; xl: number; xxl: number };
  /** Type faces: `display` = serif for titles/headings (the Retro look); `body` = system sans. */
  fonts: { display?: string; body?: string };
  /** Elevation presets — RN shadow style objects (iOS shadow* + Android elevation). */
  shadow: { sm: ViewStyle; md: ViewStyle; lg: ViewStyle };
  /** Minimum accessible tap target (pt). Do not go below this. */
  minTapTarget: number;
};

const radius = { sm: 8, md: 12, lg: 16, xl: 24, full: 999 } as const;
const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
const fontSize = { xs: 12, sm: 13, md: 15, lg: 18, xl: 22, xxl: 32 } as const;
const minTapTarget = 44;

const fonts: ThemeTokens['fonts'] = {
  // Platform serif — close in spirit to Retro's editorial display face, no font asset needed.
  display: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' }),
  body: undefined, // system sans
};

// Soft, restrained elevation (Retro is mostly flat — cards get a faint lift, buttons stay flat).
const shadow = {
  sm: { shadowColor: '#000000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  md: { shadowColor: '#000000', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  lg: { shadowColor: '#000000', shadowOpacity: 0.12, shadowRadius: 28, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
} satisfies ThemeTokens['shadow'];

export const lightColors: ColorTokens = {
  background: '#FFFFFF',
  foreground: '#0A0A0A',
  card: '#FFFFFF',
  cardForeground: '#0A0A0A',
  primary: '#0A0A0A', // near-black: solid CTA pill (white text)
  primaryForeground: '#FFFFFF',
  secondary: '#FFFFFF', // outlined pill — Button draws the foreground-colored border
  secondaryForeground: '#0A0A0A',
  muted: '#F1F1F2', // soft gray tiles
  mutedForeground: '#9A9A9F', // light gray secondary text
  accent: '#0A99F2', // the one bright blue (avatars / links / selected / pending)
  accentForeground: '#FFFFFF',
  success: '#15A148',
  successForeground: '#FFFFFF',
  warning: '#D98309',
  warningForeground: '#FFFFFF',
  destructive: '#FF3B30', // iOS/Retro red (notifications, reject)
  destructiveForeground: '#FFFFFF',
  border: '#E3E3E5',
  ring: '#0A99F2',
};

export const darkColors: ColorTokens = {
  background: '#0B0B0B',
  foreground: '#FAFAFA',
  card: '#161616',
  cardForeground: '#FAFAFA',
  primary: '#FAFAFA', // inverts in dark: white pill, black text
  primaryForeground: '#0B0B0B',
  secondary: '#0B0B0B', // outlined pill (border is foreground = near-white)
  secondaryForeground: '#FAFAFA',
  muted: '#1C1C1E',
  mutedForeground: '#8E8E93',
  accent: '#0A99F2',
  accentForeground: '#FFFFFF',
  success: '#3FB95B',
  successForeground: '#06230F',
  warning: '#E0A312',
  warningForeground: '#211603',
  destructive: '#FF453A',
  destructiveForeground: '#FFFFFF',
  border: '#2A2A2C',
  ring: '#0A99F2',
};

export const lightTheme: ThemeTokens = { colors: lightColors, radius, spacing, fontSize, fonts, shadow, minTapTarget };
export const darkTheme: ThemeTokens = { colors: darkColors, radius, spacing, fontSize, fonts, shadow, minTapTarget };
