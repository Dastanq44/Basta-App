import { useMemo } from 'react';
import { type Href, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { Avatar, Card, Screen, Text, useTheme } from '@/shared/ui';
import { userAvatarUrl, usePublicProfile } from '@/features/onboarding';
import { SyncBadge, useUserRecentSubmissions } from '@/features/proofs';
import { ActivityHeatmap } from '@/features/profile';
import { useSession } from '@/features/auth';
import type { Submission } from '@/entities';

// Read-only public profile (T-053-D). Avatar + name + bio + heatmap + recent submissions.
// The submissions list (list_viewable_user_submissions) is gated by can_view_submission — so it
// shows the author's globally-visible posts plus submissions from challenges the caller shares.
export default function UserProfileScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession();
  const myUid = session.session?.user.id;

  const profile = usePublicProfile(id);
  const submissions = useUserRecentSubmissions(id);

  const avatarRemoteUrl = useMemo(
    () => userAvatarUrl(profile.data?.avatarUrl ?? null),
    [profile.data?.avatarUrl],
  );

  // If the route lands on the caller's own id, bounce to the canonical Profile tab so
  // the user always edits their own data from the same place.
  if (id && myUid && id === myUid) {
    router.replace('/(tabs)/profile' as Href);
    return null;
  }

  if (profile.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Profile' }} />
        <Text variant="muted">Loading…</Text>
      </Screen>
    );
  }

  if (profile.isError || !profile.data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Profile' }} />
        <Text variant="title">Profile unavailable</Text>
        <Text variant="muted">
          {profile.error instanceof Error
            ? profile.error.message
            : 'Could not load this profile.'}
        </Text>
      </Screen>
    );
  }

  const p = profile.data;
  const usernameTag = p.username ? `@${p.username}` : null;

  return (
    // No 'top' edge — the native header (registered in app/_layout.tsx) owns the top inset.
    <Screen padded={false} edges={['bottom']}>
      <Stack.Screen options={{ title: p.displayName }} />
      <ScrollView contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.lg, paddingBottom: t.spacing.xl }}>
        <View style={{ alignItems: 'center', gap: t.spacing.sm, paddingVertical: t.spacing.md }}>
          {avatarRemoteUrl ? (
            <Image source={{ uri: avatarRemoteUrl }} style={{ width: 128, height: 128, borderRadius: 64 }} />
          ) : (
            <Avatar name={p.displayName} size={128} />
          )}
          <Text variant="heading" style={{ textAlign: 'center' }}>
            {p.displayName}
          </Text>
          {usernameTag ? (
            <Text variant="muted" style={{ textAlign: 'center' }}>
              {usernameTag}
            </Text>
          ) : null}
          {p.description ? (
            <Text variant="body" style={{ textAlign: 'center', paddingHorizontal: t.spacing.md }}>
              {p.description}
            </Text>
          ) : null}
        </View>

        <ActivityHeatmap submissions={submissions.data ?? []} />

        <View style={{ gap: t.spacing.sm }}>
          <Text variant="label" style={{ color: t.colors.mutedForeground }}>
            RECENT SUBMISSIONS
          </Text>
          {submissions.isPending ? (
            <Text variant="muted">Loading…</Text>
          ) : (submissions.data ?? []).length === 0 ? (
            <Card>
              <Text variant="subtitle">No visible submissions</Text>
              <Text variant="muted">
                Public posts and submissions from challenges you share will appear here.
              </Text>
            </Card>
          ) : (
            (submissions.data ?? []).map((s) => (
              <UserSubmissionRow
                key={s.id}
                submission={s}
                onPress={() => router.push(`/submission/${s.id}` as Href)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const DATE_FMT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
};

function UserSubmissionRow({ submission, onPress }: { submission: Submission; onPress: () => void }) {
  const t = useTheme();
  const title = submission.title?.trim() || 'Untitled';
  const dateLabel = new Date(submission.createdAt).toLocaleDateString(undefined, DATE_FMT);
  const subline = submission.challengeGroupName
    ? `${dateLabel} · ${submission.challengeGroupName}`
    : dateLabel;
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: t.spacing.md,
          }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="subtitle" numberOfLines={1}>
              {title}
            </Text>
            <Text variant="muted" numberOfLines={1}>
              {subline}
            </Text>
            {submission.comment ? (
              <Text variant="caption" numberOfLines={2}>
                {submission.comment}
              </Text>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Text variant="caption" style={{ color: t.colors.mutedForeground }}>
              Day {submission.challengeDay + 1}
            </Text>
            <SyncBadge status={submission.status} />
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
