// Local-only app preferences (language, theme, first-launch completion). Persisted on-device via
// expo-secure-store — NO backend involvement. Separate keys keep each value independently
// migratable. Includes backward-compat for the old language ids and the old theme-mode key.

import * as SecureStore from 'expo-secure-store';

export type AppLanguage = 'en-US' | 'kk-KZ' | 'ru-RU';
export type ThemeId = 'whiteBlue' | 'darkBlue' | 'steppeSky' | 'sageGrowth';

export const APP_LANGUAGES: readonly AppLanguage[] = ['en-US', 'kk-KZ', 'ru-RU'] as const;
export const THEME_IDS: readonly ThemeId[] = ['whiteBlue', 'darkBlue', 'steppeSky', 'sageGrowth'] as const;

export const DEFAULT_LANGUAGE: AppLanguage = 'en-US';
export const DEFAULT_THEME_ID: ThemeId = 'whiteBlue';

const LANG_KEY = 'basta.language';
const THEME_KEY = 'basta.theme-id';
const COMPLETED_KEY = 'basta.prefs-completed';
const LEGACY_THEME_MODE_KEY = 'basta.theme-mode'; // old: 'light' | 'dark' | 'system'

/** Map any raw/legacy language value (old in-house ids, BCP-47 tags, device codes) to a
 *  supported AppLanguage, or null if unrecognized. */
export function normalizeLanguage(raw: string | null | undefined): AppLanguage | null {
  if (!raw) return null;
  const v = raw.toLowerCase();
  if (v.startsWith('en')) return 'en-US';
  if (v.startsWith('ru')) return 'ru-RU';
  if (v.startsWith('kk') || v.startsWith('kz')) return 'kk-KZ';
  return null;
}

/** Map a stored/legacy theme value to a ThemeId. Migrates old theme-mode: light/system→whiteBlue,
 *  dark→darkBlue. */
function normalizeThemeId(raw: string | null | undefined): ThemeId | null {
  if (!raw) return null;
  if ((THEME_IDS as readonly string[]).includes(raw)) return raw as ThemeId;
  if (raw === 'light' || raw === 'system') return 'whiteBlue';
  if (raw === 'dark') return 'darkBlue';
  return null;
}

async function readKey(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}
async function writeKey(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // best-effort — a failed write just means the choice won't survive a restart
  }
}

export async function getStoredLanguage(): Promise<AppLanguage | null> {
  return normalizeLanguage(await readKey(LANG_KEY));
}
export async function storeLanguage(lang: AppLanguage): Promise<void> {
  await writeKey(LANG_KEY, lang);
}

export async function getStoredThemeId(): Promise<ThemeId | null> {
  const direct = normalizeThemeId(await readKey(THEME_KEY));
  if (direct) return direct;
  // One-time migration from the old theme-mode key.
  const legacy = normalizeThemeId(await readKey(LEGACY_THEME_MODE_KEY));
  if (legacy) {
    await writeKey(THEME_KEY, legacy);
    return legacy;
  }
  return null;
}
export async function storeThemeId(id: ThemeId): Promise<void> {
  await writeKey(THEME_KEY, id);
}

export async function getPrefsCompleted(): Promise<boolean> {
  return (await readKey(COMPLETED_KEY)) === 'true';
}
export async function setPrefsCompleted(done: boolean): Promise<void> {
  await writeKey(COMPLETED_KEY, done ? 'true' : 'false');
}
