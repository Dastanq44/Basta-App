import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { darkTheme, lightTheme, type ThemeTokens } from './tokens';
import { getStoredThemeMode, storeThemeMode, type ThemeMode } from '@/shared/lib/themePreference';

export type { ThemeMode } from '@/shared/lib/themePreference';

const ThemeContext = createContext<ThemeTokens>(lightTheme);

type ThemeModeContextValue = {
  /** The user's choice: 'light' | 'dark' | 'system'. */
  mode: ThemeMode;
  /** The effective resolved scheme after applying 'system'. */
  scheme: 'light' | 'dark';
  /** Change + persist the theme mode. */
  setMode: (mode: ThemeMode) => void;
};

const ThemeModeContext = createContext<ThemeModeContextValue>({
  mode: 'system',
  scheme: 'light',
  setMode: () => {},
});

/**
 * Resolves the active theme from a user-selectable mode (light / dark / system),
 * falling back to the OS color scheme when 'system'. The choice is loaded from and
 * saved to on-device storage — see `themePreference` (no backend).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  // Load the persisted choice once on mount.
  useEffect(() => {
    let active = true;
    getStoredThemeMode().then((stored) => {
      if (active && stored) setModeState(stored);
    });
    return () => {
      active = false;
    };
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    void storeThemeMode(next);
  };

  const scheme: 'light' | 'dark' = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;
  const tokens = scheme === 'dark' ? darkTheme : lightTheme;

  const value = useMemo(() => tokens, [tokens]);
  const modeValue = useMemo<ThemeModeContextValue>(() => ({ mode, scheme, setMode }), [mode, scheme]);

  return (
    <ThemeModeContext.Provider value={modeValue}>
      <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
    </ThemeModeContext.Provider>
  );
}

/** Access design tokens inside any component. */
export function useTheme(): ThemeTokens {
  return useContext(ThemeContext);
}

/** Read/change the user's theme mode (for a settings toggle). */
export function useThemeMode(): ThemeModeContextValue {
  return useContext(ThemeModeContext);
}
