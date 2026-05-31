import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { listAll, type QueuedMutation, type SubmitProofPayload } from '@/offline/queue';

/**
 * Returns the current user's queued/in-flight/failed proof submissions for a given challenge.
 * Polls on AppState changes; no realtime subscription on the SQLite table to keep things simple.
 */
export function useQueueForChallenge(challengeId: string | undefined) {
  const [items, setItems] = useState<QueuedMutation<SubmitProofPayload>[]>([]);

  useEffect(() => {
    if (!challengeId) {
      setItems([]);
      return;
    }
    let mounted = true;
    const refresh = async () => {
      const all = await listAll<SubmitProofPayload>();
      if (!mounted) return;
      setItems(
        all.filter(
          (m) => m.type === 'SUBMIT_PROOF' && m.payload.challengeId === challengeId,
        ),
      );
    };
    void refresh();
    // Re-read whenever the app comes back to foreground (the processor may have advanced).
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refresh();
    });
    // Lightweight polling — every 4s while mounted. Cheap because the table is tiny.
    const tick = setInterval(() => void refresh(), 4_000);
    return () => {
      mounted = false;
      sub.remove();
      clearInterval(tick);
    };
  }, [challengeId]);

  return items;
}
