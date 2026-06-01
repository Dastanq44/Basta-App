import { Alert, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { type Href, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, Screen, Text, useTheme } from '@/shared/ui';
import { useArchiveChallenge, useChallenge, useChallengeStreak } from '@/features/challenges';
import { useSession } from '@/features/auth';
import {
  SyncBadge,
  useQueueForChallenge,
  useSubmissions,
  useTodaySubmission,
} from '@/features/proofs';
import type { Submission, SyncStatus } from '@/entities';

// Thin route: composes domain data → primary action → list. No business logic here.
export default function ChallengeDetailScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession();
  const myUid = session.session?.user.id;
  const challenge = useChallenge(id);
  const streak = useChallengeStreak(id);
  const today = useTodaySubmission(id);
  const queueItems = useQueueForChallenge(id);
  const submissions = useSubmissions(id);
  const archive = useArchiveChallenge();

  // The "today's status" pill prefers the local queue if there's a pending/uploading entry;
  // otherwise falls back to the server-confirmed status (or "not submitted").
  const localToday = queueItems[0];
  const todayStatus: SyncStatus | null =
    localToday && (localToday.status === 'queued' || localToday.status === 'uploading' || localToday.status === 'offline_retry' || localToday.status === 'failed')
      ? localToday.status
      : today.data?.status ?? null;

  if (challenge.isPending) {
    return (
      <Screen>
        <Text variant="muted">Loading…</Text>
      </Screen>
    );
  }
  if (challenge.isError || !challenge.data) {
    return (
      <Screen>
        <Text variant="title">Challenge unavailable</Text>
        <Text variant="caption" style={{ color: t.colors.destructive }}>
          {challenge.error instanceof Error ? challenge.error.message : 'Could not load.'}
        </Text>
      </Screen>
    );
  }

  const c = challenge.data;
  const isCreator = !!myUid && c.creatorId === myUid;
  const isArchived = !!c.archivedAt;

  const confirmArchive = () => {
    Alert.alert(
      'Archive this challenge?',
      'It disappears from active lists. Existing submissions are preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: () =>
            archive.mutate(c.id, {
              onSuccess: () => router.replace('/(tabs)/challenges'),
              onError: (e: unknown) =>
                Alert.alert('Could not archive', e instanceof Error ? e.message : 'Unknown error'),
            }),
        },
      ],
      { cancelable: true },
    );
  };

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ title: c.title }} />
      <FlatList
        data={submissions.data ?? []}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: t.spacing.lg, paddingBottom: t.spacing.xl, gap: t.spacing.md }}
        ListHeaderComponent={
          <View style={{ gap: t.spacing.md, marginBottom: t.spacing.md }}>
            <View style={{ gap: t.spacing.xs }}>
              <Text variant="muted">
                {c.category} · {c.mode} · {c.durationDays} days
              </Text>
              {c.proofRequirement ? <Text variant="body">{c.proofRequirement}</Text> : null}
            </View>

            {isArchived ? (
              <Card style={{ backgroundColor: t.colors.muted }}>
                <Text variant="heading">Archived</Text>
                <Text variant="muted">
                  This challenge has been archived. History remains, but no new proofs can be
                  submitted.
                </Text>
              </Card>
            ) : null}

            {streak.data ? (
              <View style={{ flexDirection: 'row', gap: t.spacing.md }}>
                <Card style={{ flex: 1 }}>
                  <Text variant="muted">Current streak</Text>
                  <Text variant="title">🔥 {streak.data.current}</Text>
                </Card>
                <Card style={{ flex: 1 }}>
                  <Text variant="muted">Best</Text>
                  <Text variant="title">{streak.data.longest}</Text>
                </Card>
              </View>
            ) : null}

            {!isArchived ? (
              <Card>
                <View style={{ gap: t.spacing.sm }}>
                  <Text variant="heading">Today</Text>
                  {todayStatus ? (
                    <SyncBadge status={todayStatus} />
                  ) : (
                    <Text variant="muted">No proof submitted yet.</Text>
                  )}
                  <Button
                    label={todayStatus ? 'Add another (replaces today)' : "Submit today's proof"}
                    // typedRoutes hasn't generated the nested submit-proof path in the route
                    // union yet; use the resolved string href, which expo-router accepts.
                    onPress={() => router.push(`/challenge/${c.id}/submit-proof`)}
                  />
                </View>
              </Card>
            ) : null}

            <Text variant="heading" style={{ marginTop: t.spacing.md }}>
              Recent submissions
            </Text>
          </View>
        }
        ListEmptyComponent={
          submissions.isPending ? null : <Text variant="muted">No submissions yet.</Text>
        }
        refreshControl={
          <RefreshControl
            refreshing={submissions.isFetching && !submissions.isPending}
            onRefresh={() => {
              void submissions.refetch();
              void today.refetch();
              void streak.refetch();
            }}
          />
        }
        renderItem={({ item }) => <SubmissionRow submission={item} currentUserId={myUid} />}
        ListFooterComponent={
          isCreator && !isArchived ? (
            <View style={{ marginTop: t.spacing.lg, gap: t.spacing.sm }}>
              <Text variant="heading">Settings</Text>
              <Button
                label={archive.isPending ? 'Archiving…' : 'Archive challenge'}
                variant="destructive"
                onPress={confirmArchive}
                loading={archive.isPending}
                disabled={archive.isPending}
              />
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

function SubmissionRow({
  submission,
  currentUserId,
}: {
  submission: Submission;
  currentUserId: string | undefined;
}) {
  const t = useTheme();
  const router = useRouter();
  // A co-participant may verify another member's still-pending proof (server enforces this too).
  const canVerify =
    submission.status === 'pending_verification' &&
    !!currentUserId &&
    submission.authorId !== currentUserId;

  return (
    // Tap the row → submission detail (photo + reactions + comments). The Verify button below is a
    // nested Pressable, so it handles its own press without triggering navigation.
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(`/submission/${submission.id}` as Href)}
    >
      <Card>
        <View style={{ gap: t.spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text variant="heading">Day {submission.challengeDay + 1}</Text>
            <SyncBadge status={submission.status} />
          </View>
          {submission.comment ? <Text variant="muted">{submission.comment}</Text> : null}
          {canVerify ? (
            <Button
              label="Verify proof"
              variant="secondary"
              size="sm"
              // typedRoutes hasn't generated verify/[submissionId] in the route union yet;
              // the resolved string href is accepted by expo-router.
              onPress={() => router.push(`/verify/${submission.id}` as Href)}
            />
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}
