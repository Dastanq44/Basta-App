import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { THEMES, type ThemeTokens } from './tokens';
import {
  DEFAULT_THEME_ID,
  getStoredThemeId,
  storeThemeId,
  type ThemeId,
} from '@/shared/lib/appPreferences';

export type { ThemeId } from '@/shared/lib/appPreferences';

const ThemeContext = createContext<ThemeTokens>(THEMES[DEFAULT_THEME_ID]);

type ThemeModeContextValue = {
  /** The selected named theme. */
  themeId: ThemeId;
  /** Effective light/dark scheme of the active theme (drives the status bar). */
  scheme: 'light' | 'dark';
  /** Change + persist the active theme. */
  setThemeId: (id: ThemeId) => void;
  /** True until the persisted choice has loaded (so callers can avoid a wrong-theme flash). */
  ready: boolean;
};

const ThemeModeContext = createContext<ThemeModeContextValue>({
  themeId: DEFAULT_THEME_ID,
  scheme: 'light',
  setThemeId: () => {},
  ready: false,
});

/**
 * Resolves the active theme from one of four named themes (whiteBlue / darkBlue / steppeSky /
 * sageGrowth). The choice is loaded from and saved to on-device storage (appPreferences) — no
 * backend. Defaults to White + Blue until a persisted choice loads.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(DEFAULT_THEME_ID);
  const [ready, setReady] = useState(false);

  // Load the persisted choice once on mount (migrates the old theme-mode key inside the helper).
  useEffect(() => {
    let active = true;
    getStoredThemeId().then((stored) => {
      if (active && stored) setThemeIdState(stored);
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const setThemeId = (next: ThemeId) => {
    setThemeIdState(next);
    void storeThemeId(next);
  };

  const tokens = THEMES[themeId];
  const scheme: 'light' | 'dark' = tokens.isDark ? 'dark' : 'light';

  const value = useMemo(() => tokens, [tokens]);
  const modeValue = useMemo<ThemeModeContextValue>(
    () => ({ themeId, scheme, setThemeId, ready }),
    [themeId, scheme, ready],
  );

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

/** Read/change the active theme (for the preferences screen) + the resolved light/dark scheme. */
export function useThemeMode(): ThemeModeContextValue {
  return useContext(ThemeModeContext);
}
