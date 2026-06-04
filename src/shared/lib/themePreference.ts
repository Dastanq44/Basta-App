// Local-only theme preference (light / dark / system). Persisted on-device via
// expo-secure-store — NO backend involvement (the user asked to keep the backend untouched).
// Not a secret, but SecureStore is already a dependency and avoids adding MMKV/AsyncStorage.

import * as SecureStore from 'expo-secure-store';

export type ThemeMode = 'light' | 'dark' | 'system';

const KEY = 'basta.theme-mode';
const VALID: readonly ThemeMode[] = ['light', 'dark', 'system'];

/** Read the persisted theme mode, or null if unset / unreadable. */
export async function getStoredThemeMode(): Promise<ThemeMode | null> {
  try {
    const v = await SecureStore.getItemAsync(KEY);
    return v && (VALID as readonly string[]).includes(v) ? (v as ThemeMode) : null;
  } catch {
    return null;
  }
}

/** Persist the theme mode. Non-fatal on failure (the choice just won't survive a restart). */
export async function storeThemeMode(mode: ThemeMode): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, mode);
  } catch {
    // ignore — persistence is best-effort
  }
}
