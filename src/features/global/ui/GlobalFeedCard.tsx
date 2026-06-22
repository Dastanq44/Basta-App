import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
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
 * One Global feed post, hierarchy top→bottom: author identity + date, title, proof image, optional
 * comment, challenge/group context, social counts. Read-only — no verification controls, invite
 * codes, or private metadata. The proof image is a private object loaded via a short-TTL signed URL
 * (lazy per card, so FlatList windowing only signs what's on screen) and rendered with expo-image
 * (memory+disk cache). Tapping the header opens the author; tapping elsewhere opens the submission.
 */
export function GlobalFeedCard({ post, onPress, onPressAuthor }: GlobalFeedCardProps) {
  const t = useTheme();
  const media = useProofSignedUrl(post.mediaPath);
  const avatarUrl = userAvatarUrl(post.authorAvatarPath);
  const authorName = post.authorDisplayName || (post.authorUsername ? `@${post.authorUsername}` : 'Member');
  const contextLine = post.groupName ? `${post.challengeTitle} · ${post.groupName}` : post.challengeTitle;

  // Author and content are SIBLING Pressables (not nested) so tapping the author opens the
  // profile WITHOUT also firing the card's submission tap.
  return (
    <Card style={{ gap: t.spacing.md }}>
      {/* Author → profile, with the date trailing for a clear identity row. */}
      <Pressable
        accessibilityRole="button"
        onPress={onPressAuthor}
        style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}
        hitSlop={4}
      >
        <Avatar name={post.authorDisplayName ?? post.authorUsername ?? null} uri={avatarUrl} size={40} />
        <View style={{ flex: 1, gap: 1 }}>
          <Text variant="subtitle" numberOfLines={1}>{authorName}</Text>
          {post.authorUsername && post.authorDisplayName ? (
            <Text variant="caption" numberOfLines={1}>@{post.authorUsername}</Text>
          ) : null}
        </View>
        <Text variant="caption">{new Date(post.createdAt).toLocaleDateString(undefined, DATE_FMT)}</Text>
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
            <Image
              source={{ uri: media.data }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              transition={150}
              cachePolicy="memory-disk"
            />
          ) : media.isError ? (
            <Text variant="muted">Couldn&apos;t load the photo.</Text>
          ) : post.mediaPath ? (
            <ActivityIndicator color={t.colors.primary} />
          ) : (
            <Text variant="muted">No photo.</Text>
          )}
        </View>

        {post.comment ? <Text variant="body" numberOfLines={4}>{post.comment}</Text> : null}

        {/* Challenge / group context — a subtle tinted chip so it reads as metadata, not body. */}
        <View style={{ alignSelf: 'flex-start', backgroundColor: t.colors.muted, borderRadius: t.radius.full, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text variant="caption" numberOfLines={1}>{contextLine}</Text>
        </View>

        {/* Social counts — read-only, separated by a hairline for clear hierarchy. */}
        <View
          style={{
            flexDirection: 'row',
            gap: t.spacing.lg,
            paddingTop: t.spacing.sm,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: t.colors.border,
          }}
        >
          <Text variant="caption">
            {post.reactionCount} {post.reactionCount === 1 ? 'reaction' : 'reactions'}
          </Text>
          <Text variant="caption">
            {post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}
          </Text>
        </View>
      </Pressable>
    </Card>
  );
}
