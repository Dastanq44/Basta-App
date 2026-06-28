import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import {
  type Href,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  BottomSheet,
  BottomSheetMenuItem,
  Button,
  Card,
  Icon,
  Screen,
  ScreenHeader,
  Text,
  useTheme,
} from '@/shared/ui';
import {
  PublicChallengePreview,
  useChallenge,
  useChallengeAccess,
  useChallengeStreak,
  useDeleteChallenge,
} from '@/features/challenges';
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
import { formatChallengeCategory, formatDays, useI18n, type I18nKey } from '@/shared/i18n';
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
  // Resolve access first. In public-preview mode the member-only hooks are DISABLED by passing
  // `undefined` (they all gate on `enabled: !!id`), so no participant-only RPC runs for a viewer
  // who can only see the public preview.
  const { t: tr, lang } = useI18n();
  const access = useChallengeAccess(id);
  const memberId = access.data?.accessMode === 'member' ? id : undefined;
  const challenge = useChallenge(memberId);
  const streak = useChallengeStreak(memberId);
  const today = useTodaySubmission(memberId);
  const queueItems = useQueueForChallenge(memberId);
  const submissions = useSubmissions(memberId);
  const streaks = useChallengeStreaks(memberId);
  const groups = useMyGroups();
  const del = useDeleteChallenge();
  const blockedIds = useBlockedUserIds();
  const [reportOpen, setReportOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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

  // Access gate (runs before the member-data guards below).
  if (access.isPending) {
    return (
      <Screen>
        <Text variant="muted">{tr('common.loading')}</Text>
      </Screen>
    );
  }
  if (access.isError || !access.data) {
    return (
      <Screen>
        <Text variant="title">{tr('challenge.unavailable')}</Text>
        <Text variant="muted">{tr('challenge.unavailableBody')}</Text>
      </Screen>
    );
  }
  if (access.data.accessMode === 'public') {
    return <PublicChallengePreview access={access.data} />;
  }

  // ── Member detail from here (memberId === id; the member hooks are enabled). ──
  if (challenge.isPending) {
    return (
      <Screen>
        <Text variant="muted">{tr('common.loading')}</Text>
      </Screen>
    );
  }
  if (challenge.isError || !challenge.data) {
    return (
      <Screen>
        <Text variant="title">{tr('challenge.unavailable')}</Text>
        <Text variant="caption" style={{ color: t.colors.destructive }}>
          {challenge.error instanceof Error ? challenge.error.message : tr('challenge.unavailableError')}
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

  const confirmDelete = () => {
    Alert.alert(
      tr('challenge.deleteConfirmTitle'),
      tr('challenge.deleteConfirmBody'),
      [
        { text: tr('common.cancel'), style: 'cancel' },
        {
          text: tr('common.delete'),
          style: 'destructive',
          onPress: () =>
            del.mutate(c.id, {
              onSuccess: () => router.replace('/(tabs)/challenges'),
              onError: (e: unknown) =>
                Alert.alert(tr('challenge.couldNotDelete'), e instanceof Error ? e.message : tr('common.error')),
            }),
        },
      ],
      { cancelable: true },
    );
  };

  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      {/* Custom in-body header — replaces the native UINavigationBar so the bar-button
          system tap-highlight ("white circle behind the icons") never renders. */}
      <ScreenHeader
        title={c.title}
        onBack={() => router.back()}
        rightAction={{
          icon: <Icon name="settings" size={22} color={t.colors.foreground} />,
          onPress: () => setMenuOpen(true),
          accessibilityLabel: tr('challenge.settings'),
        }}
      />
      <FlatList
        data={filteredSubmissions}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: t.spacing.lg, paddingBottom: t.spacing.xl, gap: t.spacing.md }}
        ListHeaderComponent={
          <View style={{ gap: t.spacing.md, marginBottom: t.spacing.md }}>
            {/* Title is owned by the ScreenHeader above — not duplicated here. */}
            {/* Encapsulated, divided metadata chips. */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs }}>
              <MetaChip label={formatChallengeCategory(lang, c.category)} />
              <MetaChip
                label={
                  c.mode === 'group'
                    ? hostGroup
                      ? `${tr('mode.group')} · ${hostGroup.name}`
                      : tr('mode.group')
                    : tr('mode.solo')
                }
              />
              <MetaChip label={formatDays(lang, c.durationDays)} />
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
                <Text variant="heading">{tr('challenge.archived')}</Text>
                <Text variant="muted">{tr('challenge.archivedBody')}</Text>
              </Card>
            ) : null}

            {/* Streak cards. Hidden for true outsiders (streak.data === null per W-022). */}
            {streak.data ? (
              <View style={{ flexDirection: 'row', gap: t.spacing.md }}>
                <Card style={{ flex: 1 }}>
                  <Text variant="muted">{tr('challenge.currentStreak')}</Text>
                  <Text variant="title">🔥 {streak.data.current}</Text>
                </Card>
                <Card style={{ flex: 1 }}>
                  <Text variant="muted">{tr('challenge.bestStreak')}</Text>
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

            {/* Primary action is a STICKY bottom CTA (below the list) — not in the scroll. */}

            <Text variant="heading" style={{ marginTop: t.spacing.md }}>
              {tr('challenge.recentProofs')}
            </Text>
          </View>
        }
        ListEmptyComponent={
          submissions.isPending ? null : <Text variant="muted">{tr('challenge.noProofs')}</Text>
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
        // Footer Edit/Archive/Report block removed — all of those affordances moved
        // behind the headerRight 3-dot button + BottomSheet below.
      />

      {/* Sticky primary CTA — Submit / Edit, pinned above the bottom inset so the main action
          is always reachable without scrolling. Hidden when archived / locked / uploading. */}
      {primary.kind !== 'hidden' && !isArchived ? (
        <View
          style={{
            padding: t.spacing.lg,
            paddingTop: t.spacing.sm,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: t.colors.border,
            backgroundColor: t.colors.background,
          }}
        >
          <Button
            label={tr(primary.labelKey)}
            onPress={() => {
              if (primary.kind === 'submit') {
                router.push(`/challenge/${c.id}/submit-proof`);
              } else if (primary.kind === 'redact') {
                router.push(`/challenge/${c.id}/edit-proof`);
              }
            }}
          />
        </View>
      ) : null}

      {/* Challenge settings sheet (Edit for creator; Report for others). */}
      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
        {isCreator && !isArchived ? (
          <>
            <BottomSheetMenuItem
              label={tr('challenge.editChallenge')}
              onPress={() => {
                setMenuOpen(false);
                router.push(`/challenge/${c.id}/edit` as Href);
              }}
            />
            <BottomSheetMenuItem
              label={del.isPending ? tr('challenge.deleting') : tr('challenge.deleteChallenge')}
              destructive
              onPress={() => {
                setMenuOpen(false);
                confirmDelete();
              }}
            />
          </>
        ) : null}
        {!isCreator ? (
          <BottomSheetMenuItem
            label={tr('report.reportChallenge')}
            onPress={() => {
              setMenuOpen(false);
              setTimeout(() => setReportOpen(true), 250);
            }}
          />
        ) : null}
        {/* No Cancel row — the backdrop tap dismisses. */}
      </BottomSheet>

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
  | { kind: 'submit'; labelKey: I18nKey }
  | { kind: 'redact'; labelKey: I18nKey };

function computePrimaryAction(args: {
  isArchived: boolean;
  mode: ChallengeMode;
  todayStatus: ServerSubmissionStatus | null;
  queuedStatus: SyncStatus | null;
}): PrimaryAction {
  if (args.isArchived) return { kind: 'hidden' };
  if (args.queuedStatus) return { kind: 'hidden' };
  if (!args.todayStatus) return { kind: 'submit', labelKey: 'challenge.submitToday' };
  if (args.mode === 'solo') return { kind: 'redact', labelKey: 'challenge.editProof' };
  // group
  if (args.todayStatus === 'verified') return { kind: 'hidden' };
  if (args.todayStatus === 'rejected') return { kind: 'redact', labelKey: 'challenge.editResubmit' };
  return { kind: 'redact', labelKey: 'challenge.editProof' };
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

// Status tone — semantic, mapped to Steppe Sky tokens (destructive / warning-gold / success).
// Each tone draws a solid contour + a translucent same-hue fill so it reads on light + dark
// without a second palette. No hardcoded hex — the colors follow the active theme.
type StatusTone = 'danger' | 'pending' | 'done';

function StatusBar({
  mode,
  todayStatus,
}: {
  mode: ChallengeMode;
  todayStatus: ServerSubmissionStatus | null;
}) {
  const t = useTheme();
  const { t: tr } = useI18n();
  const { labelKey, tone } = describeStatus(mode, todayStatus);
  const color = { danger: t.colors.destructive, pending: t.colors.warning, done: t.colors.success }[tone];
  return (
    <View
      style={{
        paddingVertical: t.spacing.sm,
        paddingHorizontal: t.spacing.md,
        borderRadius: t.radius.md,
        backgroundColor: color + '24',
        borderWidth: 1.5,
        borderColor: color,
      }}
    >
      <Text variant="caption" style={{ color: t.colors.mutedForeground }}>{tr('challenge.todayLabel')}</Text>
      <Text variant="heading" style={{ color: t.colors.foreground }}>{tr(labelKey)}</Text>
    </View>
  );
}

function describeStatus(
  mode: ChallengeMode,
  todayStatus: ServerSubmissionStatus | null,
): { labelKey: I18nKey; tone: StatusTone } {
  if (mode === 'solo') {
    if (!todayStatus) return { labelKey: 'status.notSubmitted', tone: 'danger' };
    return { labelKey: 'status.submitted', tone: 'done' };
  }
  // group
  if (!todayStatus) return { labelKey: 'status.notSubmitted', tone: 'danger' };
  if (todayStatus === 'pending_verification') return { labelKey: 'status.pending', tone: 'pending' };
  if (todayStatus === 'verified') return { labelKey: 'status.verified', tone: 'done' };
  return { labelKey: 'status.rejected', tone: 'danger' };
}

type StreakSortKey = 'current' | 'longest';
type StreakSortDirection = 'desc' | 'asc';
type StreakSort = { key: StreakSortKey; direction: StreakSortDirection };

function ContestantsStreakRibbon({
  challengeId: _challengeId,
  myUid: _myUid,
  data,
  isPending,
}: {
  challengeId: string;
  myUid: string | undefined;
  data: ContestantStreak[];
  isPending: boolean;
}) {
  const t = useTheme();
  const { t: tr } = useI18n();
  // Streak leaderboard shows ALL contestants including the current user (Dastan's change).
  // Keep only rows with a real userId; `_myUid` is intentionally unused now.
  const others = useMemo(() => data.filter((d) => d.userId), [data]);
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
          {tr('challenge.otherContestants')}
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
  const { t: tr } = useI18n();
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
        {tr('challenge.colName')}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityHint="Sort by best streak"
        onPress={() => onSort('longest')}
        hitSlop={6}
        style={{ width: 60 }}
      >
        <Text variant="caption" style={[{ textAlign: 'right' }, activeStyle('longest')]}>
          {tr('challenge.colBest')}{arrow('longest')}
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
          {tr('challenge.colCurrent')}{arrow('current')}
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
  const { t: tr } = useI18n();
  const name = entry.displayName || entry.username || tr('common.member');
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
  const { t: tr } = useI18n();
  // A co-participant may verify another member's still-pending proof (server enforces this too).
  const canVerify =
    submission.status === 'pending_verification' &&
    !!currentUserId &&
    submission.authorId !== currentUserId;

  const authorLabel =
    submission.authorDisplayName ||
    (submission.authorUsername ? `@${submission.authorUsername}` : tr('common.member'));

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
              <Text variant="heading">{submission.title}</Text>
              <Text variant="muted">{authorLabel} · {tr('day.n', { n: submission.challengeDay + 1 })}</Text>
            </View>
            <SyncBadge status={submission.status} />
          </View>
          {submission.comment ? <Text variant="muted">{submission.comment}</Text> : null}
          {canVerify ? (
            <Button
              label={tr('verify.title')}
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
