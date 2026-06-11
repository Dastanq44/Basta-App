import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import {
  Avatar,
  BottomSheet,
  Card,
  KEYBOARD_DONE_ACCESSORY_ID,
  Text,
  useTheme,
} from '@/shared/ui';
import type { SubmissionComment } from '@/entities';
import {
  useAddComment,
  useCommentLikers,
  useComments,
  useToggleCommentLike,
} from '../hooks';

const COMMENT_MAX = 280;

/** Comments thread + composer for a submission (T-053-B). */
export function CommentsSection({ submissionId }: { submissionId: string }) {
  const t = useTheme();
  const comments = useComments(submissionId);
  const add = useAddComment(submissionId);
  const toggleLike = useToggleCommentLike(submissionId);
  const [body, setBody] = useState('');
  const [likersForCommentId, setLikersForCommentId] = useState<string | null>(null);

  const trimmed = body.trim();
  const canSend = trimmed.length > 0 && !add.isPending;

  const onSend = () => {
    if (!canSend) return;
    add.mutate(trimmed, { onSuccess: () => setBody('') });
  };

  return (
    <View style={{ gap: t.spacing.md }}>
      <Text variant="heading">Comments</Text>

      {(comments.data ?? []).map((c) => (
        <CommentRow
          key={c.id}
          comment={c}
          onToggleLike={() =>
            toggleLike.mutate({ commentId: c.id, nextLiked: !c.likedByMe })
          }
          onLongPressLike={() => setLikersForCommentId(c.id)}
        />
      ))}
      {comments.data && comments.data.length === 0 ? (
        <Text variant="muted">No comments yet — be the first.</Text>
      ) : null}

      <ComposerRow
        value={body}
        onChange={setBody}
        onSend={onSend}
        sending={add.isPending}
        canSend={canSend}
      />
      {add.isError ? (
        <Text variant="caption" style={{ color: t.colors.destructive }}>
          {add.error instanceof Error ? add.error.message : 'Could not post your comment.'}
        </Text>
      ) : null}

      <CommentLikersSheet
        commentId={likersForCommentId}
        onClose={() => setLikersForCommentId(null)}
      />
    </View>
  );
}

function CommentRow({
  comment,
  onToggleLike,
  onLongPressLike,
}: {
  comment: SubmissionComment;
  onToggleLike: () => void;
  onLongPressLike: () => void;
}) {
  const t = useTheme();
  const name = comment.authorName ?? 'Member';
  return (
    <Card>
      <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
        <Avatar
          name={comment.authorDisplayName ?? comment.authorUsername ?? null}
          size={28}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="caption">{name}</Text>
          <Text variant="body">{comment.body}</Text>
        </View>
        <HeartButton
          liked={comment.likedByMe}
          count={comment.likesCount}
          onPress={onToggleLike}
          onLongPress={onLongPressLike}
        />
      </View>
    </Card>
  );
}

function HeartButton({
  liked,
  count,
  onPress,
  onLongPress,
}: {
  liked: boolean;
  count: number;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={liked ? 'Unlike comment' : 'Like comment'}
      accessibilityHint={count > 0 ? 'Hold to see who liked it' : undefined}
      onPress={onPress}
      onLongPress={count > 0 ? onLongPress : undefined}
      hitSlop={6}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        alignSelf: 'flex-start',
      }}
    >
      <Text
        style={{
          fontSize: 16,
          color: liked ? t.colors.destructive : t.colors.mutedForeground,
          fontWeight: liked ? '700' : '400',
        }}
      >
        {liked ? '♥' : '♡'}
      </Text>
      {count > 0 ? (
        <Text
          style={{
            fontSize: t.fontSize.sm,
            color: liked ? t.colors.destructive : t.colors.mutedForeground,
            fontWeight: '600',
          }}
        >
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}

function ComposerRow({
  value,
  onChange,
  onSend,
  sending,
  canSend,
}: {
  value: string;
  onChange: (s: string) => void;
  onSend: () => void;
  sending: boolean;
  canSend: boolean;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.sm,
        borderWidth: 1,
        borderColor: t.colors.border,
        backgroundColor: t.colors.card,
        borderRadius: t.radius.full,
        paddingHorizontal: t.spacing.md,
        paddingVertical: 4,
        minHeight: 48,
      }}
    >
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Add a comment…"
        placeholderTextColor={t.colors.mutedForeground}
        maxLength={COMMENT_MAX}
        editable={!sending}
        multiline
        returnKeyType="default"
        inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}
        style={{
          flex: 1,
          color: t.colors.foreground,
          fontSize: t.fontSize.md,
          paddingVertical: 6,
          maxHeight: 120,
        }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Post comment"
        disabled={!canSend}
        onPress={onSend}
        hitSlop={6}
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: canSend ? t.colors.primary : t.colors.muted,
          opacity: sending ? 0.6 : 1,
        }}
      >
        <Text
          style={{
            fontSize: 18,
            fontWeight: '700',
            color: canSend ? t.colors.primaryForeground : t.colors.mutedForeground,
            lineHeight: 18,
          }}
        >
          ↑
        </Text>
      </Pressable>
    </View>
  );
}

function CommentLikersSheet({
  commentId,
  onClose,
}: {
  commentId: string | null;
  onClose: () => void;
}) {
  const t = useTheme();
  const likers = useCommentLikers(commentId ?? undefined, !!commentId);

  return (
    <BottomSheet visible={!!commentId} onClose={onClose}>
      <View style={{ gap: t.spacing.sm }}>
        <Text variant="heading">Liked by</Text>
        {likers.isPending ? (
          <Text variant="muted">Loading…</Text>
        ) : likers.isError ? (
          <Text variant="caption" style={{ color: t.colors.destructive }}>
            Could not load likers.
          </Text>
        ) : (likers.data ?? []).length === 0 ? (
          <Text variant="muted">Nobody liked this yet.</Text>
        ) : (
          (likers.data ?? []).map((u) => {
            const label = u.displayName ?? (u.username ? `@${u.username}` : 'Member');
            return (
              <View
                key={u.userId}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: t.spacing.sm,
                  paddingVertical: t.spacing.xs,
                }}
              >
                <Avatar name={u.displayName ?? u.username ?? null} size={32} />
                <Text variant="body">{label}</Text>
              </View>
            );
          })
        )}
      </View>
    </BottomSheet>
  );
}
