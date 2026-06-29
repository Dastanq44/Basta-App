// Semantic design tokens (shadcn mindset, adapted to native — see DECISIONS.md D-005, D-016).
// Components reference semantic names (primary, mutedForeground, …), never raw hex.
//
// FOUR named themes (the user picks one; persisted via appPreferences):
//   - whiteBlue  (DEFAULT) — clean white + blue, the everyday Basta look
//   - darkBlue              — focused evening mode, blue accent
//   - steppeSky             — contemporary Kazakh: paper cream + sky blue + restrained gold
//   - sageGrowth            — soft wellness/growth: sage surfaces, BLUE stays the primary CTA
//
// Brand rule: **blue is the strongest action color across every theme.** Gold/green are
// supporting accents (streak/rank/ornaments, or sage surfaces) — never the primary CTA.
// Rebrand = edit the hex here; one semantic token shape is shared by all four.

import type { ViewStyle } from 'react-native';
import type { ThemeId } from '@/shared/lib/appPreferences';

export type ColorTokens = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  /** Tinted brand surface for selected rows, filter chips, icon tiles. */
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

/** Liquid-glass surface tokens (used by the glass component layer + its blur/themed fallbacks).
 *  Apply alpha at the usage site — these are base colors so each theme reads correctly. */
export type GlassTokens = {
  /** Overlay tint painted over the blur (translucent at the call site). */
  tint: string;
  /** A stronger tint for higher-contrast contexts (e.g. over photos). */
  tintStrong: string;
  /** Hairline specular border on the glass edge. */
  border: string;
  /** Top highlight sheen. */
  highlight: string;
  /** Scrim painted behind clear glass to keep small text legible. */
  backdrop: string;
  /** expo-blur tint family for the non-Liquid-Glass fallback. */
  blurTint: 'light' | 'dark' | 'default';
};

export type ThemeTokens = {
  /** Which named theme produced these tokens. */
  id: ThemeId;
  /** Whether this is a dark theme (drives the status-bar content color). */
  isDark: boolean;
  colors: ColorTokens;
  glass: GlassTokens;
  radius: { sm: number; md: number; lg: number; xl: number; xxl: number; full: number };
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number; xxl: number };
  fontSize: { xs: number; sm: number; md: number; lg: number; xl: number; xxl: number; xxxl: number };
  /** Type faces. Both undefined = platform system sans (SF Pro / Roboto). */
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

// System sans on both faces — native, premium, zero font assets, full kz/ru/en glyph coverage.
const fonts: ThemeTokens['fonts'] = { display: undefined, body: undefined };

// Soft, diffused, navy-tinted elevation (premium look — never a harsh black drop shadow).
const shadow = {
  sm: { shadowColor: '#0A2540', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  md: { shadowColor: '#0A2540', shadowOpacity: 0.11, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  lg: { shadowColor: '#0A2540', shadowOpacity: 0.17, shadowRadius: 36, shadowOffset: { width: 0, height: 18 }, elevation: 12 },
} satisfies ThemeTokens['shadow'];

// ── 1. White + Blue (DEFAULT) ────────────────────────────────────────────────────────────────
const whiteBlueColors: ColorTokens = {
  background: '#F8FBFF',
  foreground: '#0F172A',
  card: '#FFFFFF',
  cardForeground: '#0F172A',
  primary: '#2563EB',
  primaryForeground: '#FFFFFF',
  primarySoft: '#DBEAFE',
  secondary: '#EEF4FF',
  secondaryForeground: '#0F172A',
  muted: '#EDF2F9',
  mutedForeground: '#5B6B7E',
  accent: '#C99412', // gold — streak/rank/ornaments only
  accentForeground: '#3A2B00',
  success: '#0F7A52',
  successForeground: '#FFFFFF',
  warning: '#C99412',
  warningForeground: '#3A2B00',
  streak: '#C99412',
  streakForeground: '#3A2B00',
  destructive: '#C44536',
  destructiveForeground: '#FFFFFF',
  border: '#D6E4FF',
  ring: '#2563EB',
};

// ── 2. Dark + Blue ─────────────────────────────────────────────────────────────────────────────
const darkBlueColors: ColorTokens = {
  background: '#0B1220',
  foreground: '#F8FAFC',
  card: '#0F1A2B',
  cardForeground: '#F8FAFC',
  primary: '#60A5FA',
  primaryForeground: '#07101F', // dark text reads on the light-blue primary
  primarySoft: '#172554',
  secondary: '#15233A',
  secondaryForeground: '#F8FAFC',
  muted: '#15233A',
  mutedForeground: '#94A3B8',
  accent: '#E7B84B',
  accentForeground: '#1A1200',
  success: '#22C55E',
  successForeground: '#04210F',
  warning: '#FBBF24',
  warningForeground: '#201700',
  streak: '#FBBF24',
  streakForeground: '#201700',
  destructive: '#F87171',
  destructiveForeground: '#2A0A06',
  border: '#243247',
  ring: '#60A5FA',
};

// ── 3. Steppe Sky (Kazakh) — paper cream + sky blue + restrained gold ──────────────────────────
const steppeSkyColors: ColorTokens = {
  background: '#FAF8F2',
  foreground: '#1E293B',
  card: '#FFFFFF',
  cardForeground: '#1E293B',
  primary: '#0E5AA8', // sky blue stays the primary CTA
  primaryForeground: '#FFFFFF',
  primarySoft: '#D9EDFA',
  secondary: '#EBEFF4',
  secondaryForeground: '#1E293B',
  muted: '#EEF2F6',
  mutedForeground: '#5C6B7B',
  accent: '#C99412', // gold — ornaments/rank/streak only
  accentForeground: '#3A2B00',
  success: '#198754',
  successForeground: '#FFFFFF',
  warning: '#C99412',
  warningForeground: '#3A2B00',
  streak: '#C99412',
  streakForeground: '#3A2B00',
  destructive: '#C44536',
  destructiveForeground: '#FFFFFF',
  border: '#D7E2EC',
  ring: '#0E5AA8',
};

// ── 4. Sage Growth — a distinct GREEN "growth" theme (emerald primary, sage surfaces). Clearly
// different from whiteBlue; green is the action color here, gold stays the streak/rank accent. ────
const sageGrowthColors: ColorTokens = {
  background: '#EAF4EC', // fresh soft green-tinted off-white (more obviously green than whiteBlue)
  foreground: '#13241B',
  card: '#FFFFFF',
  cardForeground: '#13241B',
  primary: '#15803D', // emerald — the primary CTA + selected + focus in this theme
  primaryForeground: '#FFFFFF',
  primarySoft: '#D2EEDB', // pale mint tint (selected rows / chips / progress track)
  secondary: '#DCEDDF',
  secondaryForeground: '#13241B',
  muted: '#E2EFE4',
  mutedForeground: '#52685A',
  accent: '#15803D', // coordinated green accent
  accentForeground: '#FFFFFF',
  success: '#157A45',
  successForeground: '#FFFFFF',
  warning: '#B5740C',
  warningForeground: '#FFFFFF',
  streak: '#C99412', // gold flame stays warm/legible on green
  streakForeground: '#3A2B00',
  destructive: '#C0392B',
  destructiveForeground: '#FFFFFF',
  border: '#C7E0CC',
  ring: '#15803D',
};

// Glass derives mostly from light/dark; steppeSky gets a faintly warm tint to keep its character.
function glassFor(id: ThemeId, isDark: boolean): GlassTokens {
  if (isDark) {
    return { tint: '#13233A', tintStrong: '#0C1828', border: '#86A9D6', highlight: '#FFFFFF', backdrop: '#000000', blurTint: 'dark' };
  }
  // Light themes: white glass, but steppeSky leans faintly warm and sageGrowth faintly green so the
  // glass keeps each theme's character instead of reading as a neutral grey.
  const tint = id === 'steppeSky' ? '#FFFDF7' : id === 'sageGrowth' ? '#F4FBF5' : '#FFFFFF';
  return { tint, tintStrong: tint, border: '#FFFFFF', highlight: '#FFFFFF', backdrop: '#0A2540', blurTint: 'light' };
}

function buildTheme(id: ThemeId, isDark: boolean, colors: ColorTokens): ThemeTokens {
  return { id, isDark, colors, glass: glassFor(id, isDark), radius, spacing, fontSize, fonts, shadow, minTapTarget };
}

export const THEMES: Record<ThemeId, ThemeTokens> = {
  whiteBlue: buildTheme('whiteBlue', false, whiteBlueColors),
  darkBlue: buildTheme('darkBlue', true, darkBlueColors),
  steppeSky: buildTheme('steppeSky', false, steppeSkyColors),
  sageGrowth: buildTheme('sageGrowth', false, sageGrowthColors),
};

// Back-compat aliases (some code imports lightTheme/darkTheme directly).
export const lightTheme: ThemeTokens = THEMES.whiteBlue;
export const darkTheme: ThemeTokens = THEMES.darkBlue;
