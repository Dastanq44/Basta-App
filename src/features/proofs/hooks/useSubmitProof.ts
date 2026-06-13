import { useMutation } from '@tanstack/react-query';
// SDK 54 / expo-file-system v19 split the API. The old `documentDirectory`, `copyAsync`,
// `makeDirectoryAsync` surface lives under the `/legacy` entry. The new File/Directory API is
// nicer but more invasive; pick that up in a later pass.
import * as FileSystem from 'expo-file-system/legacy';
import { enqueue, kick, type SubmitProofPayload } from '@/offline/queue';
import type { ProofInput } from '../model';

// Inline v4 UUID (no extra dep). Client-generated UUID is the submission id AND idempotency key.
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Persist a proof draft locally, then enqueue + kick the processor. The submission's media is
 * copied into the app sandbox at this moment so closing the app, force-killing, or losing the
 * picker cache cannot lose the user's proof (D-004 / W-004).
 */
export function useSubmitProof() {
  return useMutation({
    mutationFn: async (input: ProofInput): Promise<{ submissionId: string }> => {
      const submissionId = uuidv4();

      // 1. Copy media into the app sandbox at a deterministic path (so retries find it).
      const docDir = FileSystem.documentDirectory;
      if (!docDir) throw new Error('Local storage is unavailable');
      const proofsDir = `${docDir}proofs/`;
      try {
        await FileSystem.makeDirectoryAsync(proofsDir, { intermediates: true });
      } catch {
        // Already exists — fine.
      }
      const persistedUri = `${proofsDir}${submissionId}.jpg`;
      await FileSystem.copyAsync({ from: input.mediaLocalUri, to: persistedUri });

      // 2. Enqueue the SUBMIT_PROOF job. The job's `id` IS the submission id (idempotency key
      //    for the server-side `submit_proof` RPC).
      const payload: SubmitProofPayload = {
        submissionId,
        challengeId: input.challengeId,
        title: input.title,
        mediaLocalUri: persistedUri,
        comment: input.comment,
        isPublic: input.isPublic ?? false,
      };
      await enqueue({ id: submissionId, type: 'SUBMIT_PROOF', payload });

      // 3. Wake the processor immediately if online; otherwise the network listener picks it up.
      void kick();
      return { submissionId };
    },
  });
}
