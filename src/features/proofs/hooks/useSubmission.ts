import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import { getProofSignedUrl, getSubmission } from '../api';

export const submissionQueryKey = (submissionId: string) => ['submission', submissionId] as const;

/** A single submission by id — used by the verify screen. */
export function useSubmission(submissionId: string | undefined) {
  const session = useSession();
  return useQuery({
    queryKey: submissionQueryKey(submissionId ?? ''),
    queryFn: () => getSubmission(submissionId!),
    enabled: session.status === 'signedIn' && !!submissionId,
    staleTime: 15_000,
    retry: 1,
  });
}

export const proofSignedUrlQueryKey = (mediaPath: string) => ['proof-signed-url', mediaPath] as const;

/** Short-lived signed URL for a proof's private media object. */
export function useProofSignedUrl(mediaPath: string | undefined) {
  const session = useSession();
  return useQuery({
    queryKey: proofSignedUrlQueryKey(mediaPath ?? ''),
    queryFn: () => getProofSignedUrl(mediaPath),
    enabled: session.status === 'signedIn' && !!mediaPath,
    // Signed URLs expire (default 1h); refetch comfortably before then.
    staleTime: 30 * 60_000,
    retry: 1,
  });
}
