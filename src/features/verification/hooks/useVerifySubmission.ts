import { useMutation, useQueryClient } from '@tanstack/react-query';
import { submissionQueryKey, submissionsQueryKey } from '@/features/proofs';
import type { VerificationResult } from '@/entities';
import { verifySubmission } from '../api';

type VerifyVars = {
  submissionId: string;
  /** Needed to invalidate the challenge's submission list after the vote lands. */
  challengeId: string;
  result: VerificationResult;
};

/**
 * Records a verify/reject vote and refreshes the affected submission + challenge list so the new
 * server-authoritative status (verified / rejected / still pending) shows immediately.
 */
export function useVerifySubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: VerifyVars) => verifySubmission(vars.submissionId, vars.result),
    onSuccess: (_status, vars) => {
      void qc.invalidateQueries({ queryKey: submissionsQueryKey(vars.challengeId) });
      void qc.invalidateQueries({ queryKey: submissionQueryKey(vars.submissionId) });
    },
  });
}
