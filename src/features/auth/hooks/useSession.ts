import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/shared/lib/supabase';

export type SessionState =
  | { status: 'loading'; session: null }
  | { status: 'signedIn'; session: Session }
  | { status: 'signedOut'; session: null };

/**
 * Source of truth for whether the user is signed in. Reads the persisted session at mount
 * (SecureStore, see `src/shared/lib/supabase.ts`) then subscribes to auth state changes
 * so signin/signout/token-refresh propagate without polling.
 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'loading', session: null });

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
        session
          ? { status: 'signedIn', session }
          : { status: 'signedOut', session: null },
      );
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
