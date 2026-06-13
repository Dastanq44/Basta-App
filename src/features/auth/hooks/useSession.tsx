import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/shared/lib/supabase';

export type SessionState =
  | { status: 'loading'; session: null }
  | { status: 'signedIn'; session: Session }
  | { status: 'signedOut'; session: null };

const LOADING: SessionState = { status: 'loading', session: null };

const SessionContext = createContext<SessionState>(LOADING);

/**
 * Single source of truth for auth state. Holds ONE `getSession()` read + ONE
 * `onAuthStateChange` subscription for the whole app; every `useSession()` consumer reads
 * this shared value via context.
 *
 * Previously `useSession()` set up its own state + subscription on every call site (~30 of
 * them, many inside data hooks), so a single screen spun up several redundant subscriptions
 * that all re-rendered independently on each auth event. Mount this ONCE at the root, above
 * anything that calls `useSession()`.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(LOADING);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setState(
        data.session
          ? { status: 'signedIn', session: data.session }
          : { status: 'signedOut', session: null },
      );
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setState(
        session ? { status: 'signedIn', session } : { status: 'signedOut', session: null },
      );
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

/**
 * Source of truth for whether the user is signed in. Reads the shared session context
 * (one subscription for the whole app — see {@link SessionProvider}). Returns `loading`
 * until the provider resolves the persisted session.
 */
export function useSession(): SessionState {
  return useContext(SessionContext);
}
