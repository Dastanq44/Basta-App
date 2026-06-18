import { ActivityIndicator, Image, Pressable, View } from 'react-native';
import { Avatar, Card, Text, useTheme } from '@/shared/ui';
import { useProofSignedUrl } from '@/features/proofs';
import { userAvatarUrl } from '@/features/onboarding';
import type { GlobalPost } from '@/entities';

const DATE_FMT: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };

export type GlobalFeedCardProps = {
  post: GlobalPost;
  /** Open the submission detail (`/submission/[id]`). */
  onPress: () => void;
  /** Open the author's profile (`/user/[id]`). */
  onPressAuthor: () => void;
};

/**
 * One Global feed post: author identity, title, proof image, optional comment, challenge/group
 * context, date, and social counts. Read-only — no verification controls, invite codes, or private
 * metadata. The proof image is a private object loaded via a short-TTL signed URL (lazy per card,
 * so FlatList windowing only signs what's on screen). Tapping the header opens the author; tapping
 * elsewhere opens the submission.
 */
export function GlobalFeedCard({ post, onPress, onPressAuthor }: GlobalFeedCardProps) {
  const t = useTheme();
  const media = useProofSignedUrl(post.mediaPath);
  const avatarUrl = userAvatarUrl(post.authorAvatarPath);
  const authorName = post.authorDisplayName || (post.authorUsername ? `@${post.authorUsername}` : 'Member');
  const contextLine = post.groupName
    ? `${post.challengeTitle} · ${post.groupName}`
    : post.challengeTitle;

  // Author and content are SIBLING Pressables (not nested) so tapping the author opens the
  // profile WITHOUT also firing the card's submission tap.
  return (
    <Card style={{ gap: t.spacing.md }}>
      {/* Author → profile. */}
      <Pressable
        accessibilityRole="button"
        onPress={onPressAuthor}
        style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}
        hitSlop={4}
      >
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={{ width: 40, height: 40, borderRadius: 20 }} />
        ) : (
          <Avatar name={post.authorDisplayName ?? post.authorUsername ?? null} size={40} />
        )}
        <View style={{ flex: 1, gap: 1 }}>
          <Text variant="heading" numberOfLines={1}>{authorName}</Text>
          {post.authorUsername && post.authorDisplayName ? (
            <Text variant="caption" style={{ color: t.colors.mutedForeground }} numberOfLines={1}>
              @{post.authorUsername}
            </Text>
          ) : null}
        </View>
      </Pressable>

      {/* Everything else → submission. */}
      <Pressable accessibilityRole="button" onPress={onPress} style={{ gap: t.spacing.md }}>
        <Text variant="heading" numberOfLines={2}>{post.title}</Text>

        {/* Proof image. */}
        <View
          style={{
            width: '100%',
            aspectRatio: 1,
            borderRadius: t.radius.lg,
            backgroundColor: t.colors.muted,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {media.data ? (
            <Image source={{ uri: media.data }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : media.isError ? (
            <Text variant="muted">Couldn&apos;t load the photo.</Text>
          ) : post.mediaPath ? (
            <ActivityIndicator color={t.colors.primary} />
          ) : (
            <Text variant="muted">No photo.</Text>
          )}
        </View>

        {post.comment ? (
          <Text variant="body" numberOfLines={4}>{post.comment}</Text>
        ) : null}

        {/* Challenge / group context + date. */}
        <View style={{ gap: 2 }}>
          <Text variant="caption" style={{ color: t.colors.mutedForeground }} numberOfLines={1}>
            {contextLine}
          </Text>
          <Text variant="caption" style={{ color: t.colors.mutedForeground }}>
            {new Date(post.createdAt).toLocaleDateString(undefined, DATE_FMT)}
          </Text>
        </View>

        {/* Social counts — read-only. */}
        <View style={{ flexDirection: 'row', gap: t.spacing.lg }}>
          <Text variant="caption" style={{ color: t.colors.mutedForeground }}>
            {post.reactionCount} {post.reactionCount === 1 ? 'reaction' : 'reactions'}
          </Text>
          <Text variant="caption" style={{ color: t.colors.mutedForeground }}>
            {post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}
          </Text>
        </View>
      </Pressable>
    </Card>
  );
}
