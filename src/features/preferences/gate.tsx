import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getPrefsCompleted, setPrefsCompleted } from '@/shared/lib/appPreferences';

type PreferencesGateValue = {
  /** True once the persisted completion flag has loaded. */
  ready: boolean;
  /** Whether the first-launch language/theme personalization has been completed. */
  completed: boolean;
  /** Mark personalization complete (persists + flips the gate so routing advances). */
  markCompleted: () => void;
};

const PreferencesGateContext = createContext<PreferencesGateValue>({
  ready: false,
  completed: false,
  markCompleted: () => {},
});

/**
 * Loads the first-launch personalization flag once. The root navigator uses this to show the
 * preferences flow BEFORE the auth/onboarding gate on a fresh install (or for an existing user
 * with no completion marker), then never again. Kept separate from the auth gate to avoid loops.
 */
export function PreferencesGateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState({ ready: false, completed: false });

  useEffect(() => {
    let active = true;
    getPrefsCompleted().then((completed) => {
      if (active) setState({ ready: true, completed });
    });
    return () => {
      active = false;
    };
  }, []);

  const markCompleted = () => {
    setState((s) => ({ ...s, completed: true }));
    void setPrefsCompleted(true);
  };

  return (
    <PreferencesGateContext.Provider value={{ ready: state.ready, completed: state.completed, markCompleted }}>
      {children}
    </PreferencesGateContext.Provider>
  );
}

export function usePreferencesGate(): PreferencesGateValue {
  return useContext(PreferencesGateContext);
}
