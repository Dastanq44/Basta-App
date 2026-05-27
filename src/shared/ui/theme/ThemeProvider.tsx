import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { darkTheme, lightTheme, type ThemeTokens } from './tokens';

const ThemeContext = createContext<ThemeTokens>(lightTheme);

/**
 * Resolves the active theme from the OS color scheme. A user override (settings)
 * can be layered on later by passing `scheme` explicitly.
 */
export function ThemeProvider({ children, scheme }: { children: ReactNode; scheme?: 'light' | 'dark' }) {
  const system = useColorScheme();
  const active = (scheme ?? system) === 'dark' ? darkTheme : lightTheme;
  const value = useMemo(() => active, [active]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Access design tokens inside any component. */
export function useTheme(): ThemeTokens {
  return useContext(ThemeContext);
}
