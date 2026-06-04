import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  View,
} from 'react-native';
import {
  type Href,
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Card, Screen, Text, useTheme } from '@/shared/ui';
import { useArchiveChallenge, useChallenge, useChallengeStreak } from '@/features/challenges';
import { useSession } from '@/features/auth';
import { useMyGroups } from '@/features/groups';
import { ReportSheet, useBlockedUserIds } from '@/features/moderation';
import {
  SyncBadge,
  challengeStreaksQueryKey,
  todaySubmissionQueryKey,
  useChallengeStreaks,
  useQueueForChallenge,
  useSubmissions,
  useTodaySubmission,
} from '@/features/proofs';
import type {
  ChallengeMode,
  ContestantStreak,
  ServerSubmissionStatus,
  Submission,
  SyncStatus,
} from '@/entities';

// Thin route: composes domain data → primary action → list. No business logic here.
export default function ChallengeDetailScreen() {
  const t = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession();
  const myUid = session.session?.user.id;
  const challenge = useChallenge(id);
  const streak = useChallengeStreak(id);
  const today = useTodaySubmission(id);
  const queueItems = useQueueForChallenge(id);
  const submissions = useSubmissions(id);
  const streaks = useChallengeStreaks(id);
  const groups = useMyGroups();
  const archive = useArchiveChallenge();
  const blockedIds = useBlockedUserIds();
  const [reportOpen, setReportOpen] = useState(false);

  // Day-rollover refresh: each time the screen comes back into focus, re-fetch the
  // today-keyed queries. Server still owns the truth (computes today_day per the user's
  // tz, see W-027), but the cached result would otherwise stay yesterday's after midnight.
  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      void qc.invalidateQueries({ queryKey: todaySubmissionQueryKey(id) });
      void qc.invalidateQueries({ queryKey: challengeStreaksQueryKey(id) });
    }, [id, qc]),
  );

  const localToday = queueItems[0];
  const queuedStatus: SyncStatus | null =
    localToday && (localToday.status === 'queued' || localToday.status === 'uploading' || localToday.status === 'offline_retry' || localToday.status === 'failed')
      ? localToday.status
      : null;

  const filteredSubmissions = useMemo(
    () => (submissions.data ?? []).filter((s) => !blockedIds.has(s.authorId)),
    [submissions.data, blockedIds],
  );

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
  const hostGroup = c.groupId ? groups.data?.find((g) => g.id === c.groupId) : undefined;

  // Server-confirmed submissions only carry server statuses ('pending_verification' |
  // 'verified' | 'rejected'); the wider SyncStatus union on Submission.status reflects
  // the client states that exist BEFORE the row reaches the server. Narrowed here.
  const todayStatus = (today.data?.status ?? null) as ServerSubmissionStatus | null;
  const primary = computePrimaryAction({
    isArchived,
    mode: c.mode,
    todayStatus,
    queuedStatus,
  });

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
    // edges={['bottom']}: the native Stack header already handles top safe-area inset; if
    // we included 'top' here too, SafeAreaView would add a background-colored stripe under
    // the header that the FlatList scrolls behind.
    <Screen padded={false} edges={['bottom']}>
      <Stack.Screen options={{ title: c.title }} />
      <FlatList
        data={filteredSubmissions}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: t.spacing.lg, paddingBottom: t.spacing.xl, gap: t.spacing.md }}
        ListHeaderComponent={
          <View style={{ gap: t.spacing.md, marginBottom: t.spacing.md }}>
            {/* Header: name as the main title (the stack screen title carries it too, but a
                large in-screen title gives the page a clear top). */}
            <Text variant="title">{c.title}</Text>

            {/* Encapsulated, divided metadata chips. */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs }}>
              <MetaChip label={titleCase(c.category)} />
              <MetaChip
                label={
                  c.mode === 'group'
                    ? hostGroup
                      ? `Group · ${hostGroup.name}`
                      : 'Group'
                    : 'Solo'
                }
              />
              <MetaChip label={`${c.durationDays} days`} />
            </View>

            {c.proofRequirement ? (
              <Text variant="body" style={{ color: t.colors.mutedForeground }}>
                {c.proofRequirement}
              </Text>
            ) : null}

            {/* Status bar — what's happening with today's proof. */}
            <StatusBar mode={c.mode} todayStatus={todayStatus} />

            {/* Offline / queued state (rare but real): the sync badge surfaces upload progress. */}
            {queuedStatus ? (
              <View style={{ alignSelf: 'flex-start' }}>
                <SyncBadge status={queuedStatus} />
              </View>
            ) : null}

            {isArchived ? (
              <Card style={{ backgroundColor: t.colors.muted }}>
                <Text variant="heading">Archived</Text>
                <Text variant="muted">
                  This challenge has been archived. History remains, but no new proofs can be
                  submitted.
                </Text>
              </Card>
            ) : null}

            {/* Streak cards. Hidden for true outsiders (streak.data === null per W-022). */}
            {streak.data ? (
              <View style={{ flexDirection: 'row', gap: t.spacing.md }}>
                <Card style={{ flex: 1 }}>
                  <Text variant="muted">Current streak</Text>
                  <Text variant="title">🔥 {streak.data.current}</Text>
                </Card>
                <Card style={{ flex: 1 }}>
                  <Text variant="muted">Best Streak</Text>
                  <Text variant="title">{streak.data.longest}</Text>
                </Card>
              </View>
            ) : null}

            {/* Other contestants' streaks — group challenges only. Excludes self (the
                Current/Best cards above are already the caller's own stats). */}
            {c.mode === 'group' ? (
              <ContestantsStreakRibbon
                challengeId={c.id}
                myUid={myUid}
                data={streaks.data ?? []}
                isPending={streaks.isPending}
              />
            ) : null}

            {/* The primary action — single button. Submit / Edit / hidden, based on
                today's status + mode (see computePrimaryAction). */}
            {primary.kind !== 'hidden' && !isArchived ? (
              <Button
                label={primary.label}
                onPress={() => {
                  if (primary.kind === 'submit') {
                    router.push(`/challenge/${c.id}/submit-proof`);
                  } else if (primary.kind === 'redact') {
                    router.push(`/challenge/${c.id}/edit-proof`);
                  }
                }}
              />
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
              void streaks.refetch();
            }}
          />
        }
        renderItem={({ item }) => <SubmissionRow submission={item} currentUserId={myUid} />}
        ListFooterComponent={
          <View style={{ marginTop: t.spacing.lg, gap: t.spacing.sm }}>
            {isCreator && !isArchived ? (
              <>
                <Text variant="heading">Settings</Text>
                <Button
                  label="Edit challenge"
                  variant="secondary"
                  onPress={() => router.push(`/challenge/${c.id}/edit` as Href)}
                  disabled={archive.isPending}
                />
                <Button
                  label={archive.isPending ? 'Archiving…' : 'Archive challenge'}
                  variant="destructive"
                  onPress={confirmArchive}
                  loading={archive.isPending}
                  disabled={archive.isPending}
                />
              </>
            ) : null}
            {!isCreator ? (
              <Pressable accessibilityRole="button" onPress={() => setReportOpen(true)} hitSlop={4}>
                <Text variant="muted" style={{ textAlign: 'center' }}>Report this challenge</Text>
              </Pressable>
            ) : null}
          </View>
        }
      />
      <ReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="challenge"
        targetId={c.id}
        targetLabel="this challenge"
      />
    </Screen>
  );
}

// --------------------------------------------------------------------------------------
// Primary action — the single Submit / Edit button.
//
// Rules (mirrors server-side enforcement in redact_my_submission):
//   * Archived: hidden (no actions allowed).
//   * No today submission: Submit.
//   * Solo + has today submission: Edit (same-day only; tomorrow this row won't be "today"
//     anymore so the no-today-submission branch above kicks in again).
//   * Group + pending_verification | rejected: Edit (votes are cleared server-side).
//   * Group + verified: hidden (locked).
//   * Queued / uploading locally: hidden — the sync badge above the button is the action.
// --------------------------------------------------------------------------------------
type PrimaryAction =
  | { kind: 'hidden' }
  | { kind: 'submit'; label: string }
  | { kind: 'redact'; label: string };

function computePrimaryAction(args: {
  isArchived: boolean;
  mode: ChallengeMode;
  todayStatus: ServerSubmissionStatus | null;
  queuedStatus: SyncStatus | null;
}): PrimaryAction {
  if (args.isArchived) return { kind: 'hidden' };
  if (args.queuedStatus) return { kind: 'hidden' };
  if (!args.todayStatus) return { kind: 'submit', label: "Submit today's proof" };
  if (args.mode === 'solo') return { kind: 'redact', label: 'Edit submission' };
  // group
  if (args.todayStatus === 'verified') return { kind: 'hidden' };
  if (args.todayStatus === 'rejected') return { kind: 'redact', label: 'Edit and resubmit' };
  return { kind: 'redact', label: 'Edit submission' };
}

// --------------------------------------------------------------------------------------
// Subcomponents
// --------------------------------------------------------------------------------------

function MetaChip({ label }: { label: string }) {
  const t = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: t.spacing.md,
        paddingVertical: 6,
        borderRadius: t.radius.lg,
        backgroundColor: t.colors.muted,
        borderWidth: 1,
        borderColor: t.colors.border,
      }}
    >
      <Text style={{ color: t.colors.foreground, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

// Status palette — bumped up from the prior muted set per the user's "a bit brighter"
// note. Each state has a solid border color (the contour) and a tinted same-hue fill
// (translucent so it reads on both light and dark theme backgrounds without two
// separate palettes). Still intentionally not neon — these sit one step below the
// theme's `success` / `warning` / `destructive` brights.
const STATUS_RED_BORDER = '#D45656';
const STATUS_RED_BG = 'rgba(212, 86, 86, 0.16)';
const STATUS_AMBER_BORDER = '#ffc125';
const STATUS_AMBER_BG = 'rgba(255, 183, 0, 0.39)';
const STATUS_GREEN_BORDER = '#6FAE85';
const STATUS_GREEN_BG = 'rgba(111, 174, 133, 0.18)';

function StatusBar({
  mode,
  todayStatus,
}: {
  mode: ChallengeMode;
  todayStatus: ServerSubmissionStatus | null;
}) {
  const t = useTheme();
  const { label, border, fill } = describeStatus(mode, todayStatus);
  return (
    <View
      style={{
        paddingVertical: t.spacing.sm,
        paddingHorizontal: t.spacing.md,
        borderRadius: t.radius.md,
        // Tinted same-hue fill (translucent → tints whatever theme bg sits below) +
        // a solid contour in the matching state color. No left-side accent.
        backgroundColor: fill,
        borderWidth: 1.5,
        borderColor: border,
      }}
    >
      <Text variant="caption" style={{ color: t.colors.mutedForeground }}>Today</Text>
      <Text variant="heading" style={{ color: t.colors.foreground }}>{label}</Text>
    </View>
  );
}

function describeStatus(
  mode: ChallengeMode,
  todayStatus: ServerSubmissionStatus | null,
): { label: string; border: string; fill: string } {
  if (mode === 'solo') {
    if (!todayStatus) return { label: 'Not submitted', border: STATUS_RED_BORDER, fill: STATUS_RED_BG };
    return { label: 'Submitted', border: STATUS_GREEN_BORDER, fill: STATUS_GREEN_BG };
  }
  // group
  if (!todayStatus) return { label: 'Not submitted', border: STATUS_RED_BORDER, fill: STATUS_RED_BG };
  if (todayStatus === 'pending_verification') return { label: 'Pending verification', border: STATUS_AMBER_BORDER, fill: STATUS_AMBER_BG };
  if (todayStatus === 'verified') return { label: 'Verified', border: STATUS_GREEN_BORDER, fill: STATUS_GREEN_BG };
  return { label: 'Rejected', border: STATUS_RED_BORDER, fill: STATUS_RED_BG };
}

type StreakSortKey = 'current' | 'longest';
type StreakSortDirection = 'desc' | 'asc';
type StreakSort = { key: StreakSortKey; direction: StreakSortDirection };

function ContestantsStreakRibbon({
  challengeId: _challengeId,
  myUid,
  data,
  isPending,
}: {
  challengeId: string;
  myUid: string | undefined;
  data: ContestantStreak[];
  isPending: boolean;
}) {
  const t = useTheme();
  // Self is shown by the Current/Best cards above — exclude from the table.
  // Changed by person (Dastan) so that streak leaderboards show all users including current.
  // const others = useMemo(() => data.filter((d) => d.userId !== myUid), [data, myUid]); 
  const others = useMemo(() => data.filter((d) => d.userId), [data, myUid]); 
  // Default: sort by Current, biggest streak first.
  const [sort, setSort] = useState<StreakSort>({ key: 'current', direction: 'desc' });

  // Sort by the selected column in the requested direction. Tiebreakers fall through to
  // the other streak column (always desc — "more streak = better" regardless of primary
  // direction) and then to the username so the order is stable.
  const sorted = useMemo(() => {
    const copy = [...others];
    const getPrimary = (s: ContestantStreak) => (sort.key === 'current' ? s.current : s.longest);
    const getSecondary = (s: ContestantStreak) =>
      sort.key === 'current' ? s.longest : s.current;
    const sign = sort.direction === 'desc' ? 1 : -1;
    copy.sort((a, b) => {
      const primary = (getPrimary(b) - getPrimary(a)) * sign;
      if (primary !== 0) return primary;
      const secondary = getSecondary(b) - getSecondary(a);
      if (secondary !== 0) return secondary;
      return (a.displayName || a.username || '').localeCompare(b.displayName || b.username || '');
    });
    return copy;
  }, [others, sort]);

  if (isPending) return null;
  if (others.length === 0) return null;

  // Tap-to-sort: same column → flip direction; different column → switch and reset to
  // descending (the natural "top performer first" default). Mirrors the convention used
  // by every table sort UX.
  const onHeaderPress = (key: StreakSortKey) =>
    setSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'desc' ? 'asc' : 'desc' }
        : { key, direction: 'desc' },
    );

  return (
    <View
      style={{
        gap: t.spacing.xs,
        backgroundColor: t.colors.card,
        borderRadius: t.radius.md,
        borderWidth: 1,
        borderColor: t.colors.border,
        padding: t.spacing.sm,
      }}
    >
      <View style={{ paddingHorizontal: t.spacing.xs, paddingTop: 2 }}>
        <Text variant="caption" style={{ color: t.colors.mutedForeground }}>
          Other contestants
        </Text>
      </View>

      {/* Column headers double as sort controls — tap a column to sort by it; tap the
          active column again to flip asc/desc. */}
      <ContestantsHeaderRow sort={sort} onSort={onHeaderPress} />

      {/* Rows */}
      <View>
        {sorted.map((entry, i) => (
          <ContestantsBodyRow
            key={entry.userId}
            entry={entry}
            sortKey={sort.key}
            isLast={i === sorted.length - 1}
          />
        ))}
      </View>
    </View>
  );
}

function ContestantsHeaderRow({
  sort,
  onSort,
}: {
  sort: StreakSort;
  onSort: (key: StreakSortKey) => void;
}) {
  const t = useTheme();
  const arrow = (k: StreakSortKey) =>
    sort.key === k ? (sort.direction === 'desc' ? ' ↓' : ' ↑') : '';
  const activeStyle = (k: StreakSortKey) =>
    sort.key === k
      ? { color: t.colors.foreground, fontWeight: '700' as const }
      : { color: t.colors.mutedForeground };
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: t.spacing.xs,
        paddingVertical: t.spacing.xs,
        borderBottomWidth: 1,
        borderBottomColor: t.colors.border,
      }}
    >
      <Text variant="caption" style={{ flex: 1, color: t.colors.mutedForeground }}>
        Name
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Sort by best streak"
        onPress={() => onSort('longest')}
        hitSlop={6}
        style={{ width: 60 }}
      >
        <Text variant="caption" style={[{ textAlign: 'right' }, activeStyle('longest')]}>
          Best{arrow('longest')}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Sort by current streak"
        onPress={() => onSort('current')}
        hitSlop={6}
        style={{ width: 72 }}
      >
        <Text variant="caption" style={[{ textAlign: 'right' }, activeStyle('current')]}>
          Current{arrow('current')}
        </Text>
      </Pressable>
    </View>
  );
}

function ContestantsBodyRow({
  entry,
  sortKey,
  isLast,
}: {
  entry: ContestantStreak;
  sortKey: StreakSortKey;
  isLast: boolean;
}) {
  const t = useTheme();
  const name = entry.displayName || entry.username || 'Member';
  const activeWeight = (k: StreakSortKey) =>
    sortKey === k ? ('700' as const) : ('500' as const);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: t.spacing.xs,
        paddingVertical: t.spacing.sm,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: t.colors.border,
      }}
    >
      <Text
        style={{ flex: 1, color: t.colors.foreground, fontWeight: '500' }}
        numberOfLines={1}
      >
        {name}
      </Text>
      <Text
        style={{
          width: 60,
          textAlign: 'right',
          color: t.colors.foreground,
          fontWeight: activeWeight('longest'),
        }}
      >
        {entry.longest}
      </Text>
      <Text
        style={{
          width: 72,
          textAlign: 'right',
          color: t.colors.foreground,
          fontWeight: activeWeight('current'),
        }}
      >
        🔥 {entry.current}
      </Text>
    </View>
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

  const authorLabel =
    submission.authorDisplayName ||
    (submission.authorUsername ? `@${submission.authorUsername}` : 'Member');

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
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="heading">{authorLabel}</Text>
              <Text variant="muted">Day {submission.challengeDay + 1}</Text>
            </View>
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

function titleCase(s: string): string {
  if (!s) return s;
  return s[0]!.toUpperCase() + s.slice(1);
}
