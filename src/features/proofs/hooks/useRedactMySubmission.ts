import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import { uploadProofMedia } from '@/offline/upload/storage';
import { redactMySubmission } from '../api';
import { submissionsQueryKey } from './useSubmissions';
import { todaySubmissionQueryKey } from './useTodaySubmission';
import { submissionQueryKey, proofSignedUrlQueryKey } from './useSubmission';
import { challengeStreaksQueryKey } from './useChallengeStreaks';

export type RedactSubmissionInput = {
  /** The existing submission row's id (also the storage filename — see uploadProofMedia). */
  submissionId: string;
  challengeId: string;
  /** New title (1..80 chars). Required since W-034. */
  title: string;
  /** Local file URI from ImagePicker. The hook uploads it (overwriting the deterministic
   *  storage path) then calls the redact RPC. */
  mediaLocalUri: string;
  /** Optional new note. Empty string ⇒ cleared. */
  comment?: string;
};

/**
 * Author-only edit of an already-submitted proof. Uploads the new photo at the SAME
 * deterministic storage path (`<uid>/<challengeId>/<submissionId>.jpg`, upsert overwrites)
 * then calls `redact_my_submission` on the server.
 *
 * Direct path — NOT routed through the offline queue. Editing requires connectivity by
 * design: there is no draft to lose, and queuing edits offline would race against
 * verifications happening on the prior content.
 */
export function useRedactMySubmission() {
  const qc = useQueryClient();
  const session = useSession();
  return useMutation({
    mutationFn: async (input: RedactSubmissionInput): Promise<{ remotePath: string }> => {
      const uid = session.session?.user.id;
      if (!uid) throw new Error('You must be signed in to edit a submission.');

      // Re-upload at the deterministic path so the existing media_path stays valid and
      // the old bytes are overwritten in one shot (no orphaned objects in Storage).
      const { remotePath } = await uploadProofMedia({
        userId: uid,
        challengeId: input.challengeId,
        submissionId: input.submissionId,
        localUri: input.mediaLocalUri,
      });

      await redactMySubmission(input.submissionId, input.title, remotePath, input.comment);
      return { remotePath };
    },
    onSuccess: (data, input) => {
      // Today / list / single / streak / streaks-ribbon all depend on the edited row.
      qc.invalidateQueries({ queryKey: todaySubmissionQueryKey(input.challengeId) });
      qc.invalidateQueries({ queryKey: submissionsQueryKey(input.challengeId) });
      qc.invalidateQueries({ queryKey: submissionQueryKey(input.submissionId) });
      qc.invalidateQueries({ queryKey: challengeStreaksQueryKey(input.challengeId) });
      // The single-user streak query lives under ['challenge-streak', id] (note: singular).
      qc.invalidateQueries({ queryKey: ['challenge-streak', input.challengeId] });
      // Bust the signed-URL cache for the (unchanged) media path so the new bytes load.
      qc.invalidateQueries({ queryKey: proofSignedUrlQueryKey(data.remotePath) });
    },
  });
}
