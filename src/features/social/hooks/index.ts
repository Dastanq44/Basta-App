import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/features/auth';
import { globalFeedQueryKey } from '@/features/global';
import {
  addComment,
  getComments,
  getReactions,
  listCommentLikers,
  listReactionReactors,
  reactToSubmission,
  setCommentLike,
} from '../api';
import type { SubmissionComment } from '@/entities';

export const reactionsQueryKey = (submissionId: string) => ['reactions', submissionId] as const;
export const commentsQueryKey = (submissionId: string) => ['comments', submissionId] as const;
export const commentLikersQueryKey = (commentId: string) =>
  ['comment-likers', commentId] as const;
export const reactionReactorsQueryKey = (submissionId: string, emoji: string) =>
  ['reaction-reactors', submissionId, emoji] as const;

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reactionsQueryKey(submissionId) });
      // Global feed cards show a reaction count — refresh it.
      qc.invalidateQueries({ queryKey: globalFeedQueryKey });
    },
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: commentsQueryKey(submissionId) });
      // Global feed cards show a comment count — refresh it.
      qc.invalidateQueries({ queryKey: globalFeedQueryKey });
    },
  });
}

/**
 * Toggle the current user's like on a comment. Writes optimistically into the comments
 * cache so the heart + count flip immediately; reverts on error.
 */
export function useToggleCommentLike(submissionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, nextLiked }: { commentId: string; nextLiked: boolean }) =>
      setCommentLike(commentId, nextLiked),
    onMutate: async ({ commentId, nextLiked }) => {
      const key = commentsQueryKey(submissionId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<SubmissionComment[]>(key);
      if (prev) {
        qc.setQueryData<SubmissionComment[]>(
          key,
          prev.map((c) =>
            c.id === commentId
              ? {
                  ...c,
                  likedByMe: nextLiked,
                  likesCount: Math.max(0, c.likesCount + (nextLiked ? 1 : -1)),
                }
              : c,
          ),
        );
      }
      return { prev };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(commentsQueryKey(submissionId), ctx.prev);
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: commentsQueryKey(submissionId) });
      qc.invalidateQueries({ queryKey: commentLikersQueryKey(vars.commentId) });
    },
  });
}

/** Users who liked a given comment — used by the long-press popover. */
export function useCommentLikers(commentId: string | undefined, enabled: boolean) {
  const session = useSession();
  return useQuery({
    queryKey: commentLikersQueryKey(commentId ?? ''),
    queryFn: () => listCommentLikers(commentId!),
    enabled: enabled && session.status === 'signedIn' && !!commentId,
    staleTime: 15_000,
    retry: 1,
  });
}

/** Users who reacted to a submission with a given emoji — for the long-press popover on a chip. */
export function useReactionReactors(
  submissionId: string | undefined,
  emoji: string | undefined,
  enabled: boolean,
) {
  const session = useSession();
  return useQuery({
    queryKey: reactionReactorsQueryKey(submissionId ?? '', emoji ?? ''),
    queryFn: () => listReactionReactors(submissionId!, emoji!),
    enabled: enabled && session.status === 'signedIn' && !!submissionId && !!emoji,
    staleTime: 15_000,
    retry: 1,
  });
}
