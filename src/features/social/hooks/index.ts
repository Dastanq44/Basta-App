import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import { addComment, getComments, getReactions, reactToSubmission } from '../api';

export const reactionsQueryKey = (submissionId: string) => ['reactions', submissionId] as const;
export const commentsQueryKey = (submissionId: string) => ['comments', submissionId] as const;

export function useReactions(submissionId: string | undefined) {
  const session = useSession();
  return useQuery({
    queryKey: reactionsQueryKey(submissionId ?? ''),
    queryFn: () => getReactions(submissionId!),
    enabled: session.status === 'signedIn' && !!submissionId,
    staleTime: 15_000,
    retry: 1,
  });
}

export function useReactToSubmission(submissionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (emoji: string | null) => reactToSubmission(submissionId, emoji),
    onSuccess: () => qc.invalidateQueries({ queryKey: reactionsQueryKey(submissionId) }),
  });
}

export function useComments(submissionId: string | undefined) {
  const session = useSession();
  return useQuery({
    queryKey: commentsQueryKey(submissionId ?? ''),
    queryFn: () => getComments(submissionId!),
    enabled: session.status === 'signedIn' && !!submissionId,
    staleTime: 15_000,
    retry: 1,
  });
}

export function useAddComment(submissionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => addComment(submissionId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: commentsQueryKey(submissionId) }),
  });
}
