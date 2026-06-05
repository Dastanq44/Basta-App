import { useMemo, useState } from 'react';
import { Alert, FlatList, Image, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { type Href, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Avatar,
  BottomSheet,
  BottomSheetMenuItem,
  Button,
  Card,
  CrownIcon,
  Icon,
  Screen,
  SegmentedControl,
  Text,
  useTheme,
} from '@/shared/ui';
import { useSession } from '@/features/auth';
import { useChallenges } from '@/features/challenges';
import {
  useArchiveGroup,
  useGroupOverview,
  useLeaveGroup,
  useMyGroups,
  useTransferGroupLeadership,
} from '@/features/groups';
import { useGroupLeaderboard } from '@/features/leaderboard';
import { ReportSheet } from '@/features/moderation';
import type { Challenge, LeaderboardEntry } from '@/entities';

type Tab = 'main' | 'board' | 'global';

// Group detail: three tabs (Main info / Leaderboard / Global placeholder) + a gear action menu
// (owner → edit/archive; everyone → leave/report). Server enforces every action server-side.
export default function GroupScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession();
  const myUid = session.session?.user.id;
  const groups = useMyGroups();
  const overview = useGroupOverview(id);
  const board = useGroupLeaderboard(id);
  const challenges = useChallenges();
  const leave = useLeaveGroup();
  const archive = useArchiveGroup();
  const transfer = useTransferGroupLeadership();
  const [tab, setTab] = useState<Tab>('main');
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const group = groups.data?.find((g) => g.id === id);
  const isOwner = !!myUid && group?.ownerId === myUid;

  // Active challenges scoped to this group. `useChallenges` already excludes archived;
  // we only need the group-scope filter.
  const activeGroupChallenges = useMemo(
    () => (challenges.data ?? []).filter((c) => c.groupId === id),
    [challenges.data, id],
  );

  const confirmTransfer = (entry: LeaderboardEntry) => {
    if (!id) return;
    const displayName = entry.displayName || entry.username || 'this member';
    Alert.alert(
      `Make ${displayName} the leader?`,
      "They'll be able to rename and archive the group. You'll become a regular member.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          style: 'destructive',
          onPress: () =>
            transfer.mutate(
              { groupId: id, newOwnerId: entry.userId },
              { onError: (e) => Alert.alert('Could not transfer', e instanceof Error ? e.message : 'Unknown error') },
            ),
        },
      ],
      { cancelable: true },
    );
  };

  const confirmLeave = () => {
    if (!id) return;
    Alert.alert(
      'Leave this group?',
      'You will need a fresh invite code to rejoin.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () =>
            leave.mutate(id, {
              onSuccess: () => router.replace('/(tabs)/groups'),
              onError: (e) => Alert.alert('Could not leave', e instanceof Error ? e.message : 'Unknown error'),
            }),
        },
      ],
      { cancelable: true },
    );
  };

  const confirmArchive = () => {
    if (!id) return;
    Alert.alert(
      'Archive this group?',
      'It disappears from active lists. Existing data is preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: () =>
            archive.mutate(id, {
              onSuccess: () => router.replace('/(tabs)/groups'),
              onError: (e) => Alert.alert('Could not archive', e instanceof Error ? e.message : 'Unknown error'),
            }),
        },
      ],
      { cancelable: true },
    );
  };

  if (!groups.isPending && !group) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Group' }} />
        <View style={{ gap: t.spacing.md }}>
          <Text variant="title">Group unavailable</Text>
          <Text variant="muted">
            This group has been archived, you&apos;re no longer a member, or it no longer exists.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: group?.name ?? 'Group',
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Group settings"
              hitSlop={8}
              onPress={() => setMenuOpen(true)}
              // Match the Profile/Challenge 3-dot button: 40×40 circle with opacity dip
              // on press (no native highlight color flicker — polish A + C).
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                marginRight: 4,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.5 : 1,
              })}
            >
              <Icon name="settings" size={22} color={t.colors.foreground} />
            </Pressable>
          ),
        }}
      />

      <View style={{ paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.md }}>
        <SegmentedControl
          options={
            [
              { label: 'Main', value: 'main' },
              { label: 'Leaderboard', value: 'board' },
              { label: 'Global', value: 'global' },
            ] as const
          }
          value={tab}
          onChange={setTab}
        />
      </View>

      {tab === 'main' ? (
        <ScrollView contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.md, paddingBottom: t.spacing.xl }}>
          <View style={{ alignItems: 'center', gap: t.spacing.sm }}>
            {overview.data?.avatarUrl ? (
              <Image source={{ uri: overview.data.avatarUrl }} style={{ width: 88, height: 88, borderRadius: 44 }} />
            ) : (
              <Avatar name={group?.name ?? '?'} size={88} />
            )}
            <Text variant="title" style={{ textAlign: 'center' }}>
              {group?.name ?? 'Group'}
            </Text>
            {overview.data?.description ? (
              <Text variant="muted" style={{ textAlign: 'center' }}>
                {overview.data.description}
              </Text>
            ) : null}
          </View>

          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="muted">Members</Text>
              <Text variant="subtitle">{overview.data?.memberCount ?? '—'}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: t.spacing.sm }}>
              <Text variant="muted">Created</Text>
              <Text variant="subtitle">
                {overview.data?.createdAt ? new Date(overview.data.createdAt).toLocaleDateString() : '—'}
              </Text>
            </View>
          </Card>

          {/* Below main info: create-in-group button → wizard pre-seeded with this group. */}
          <Button
            label="+ New challenge"
            onPress={() => router.push(`/challenge/new?groupId=${id}` as Href)}
          />

          {/* Active challenges in this group. Skipped while the global list is loading so
              we don't flash an empty state, and hidden entirely if the group has none. */}
          {challenges.isPending ? null : activeGroupChallenges.length > 0 ? (
            <View style={{ gap: t.spacing.sm }}>
              <Text variant="subtitle">Active challenges</Text>
              <View style={{ gap: t.spacing.xs }}>
                {activeGroupChallenges.map((c) => (
                  <GroupChallengeRow
                    key={c.id}
                    challenge={c}
                    onPress={() => router.push(`/challenge/${c.id}` as Href)}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      ) : tab === 'board' ? (
        <FlatList
          data={board.data ?? []}
          keyExtractor={(e) => e.userId}
          contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.sm, paddingBottom: t.spacing.xl }}
          ListEmptyComponent={
            board.isPending ? (
              <Text variant="muted">Loading…</Text>
            ) : board.isError ? (
              <Text variant="caption" style={{ color: t.colors.destructive }}>
                {board.error instanceof Error ? board.error.message : 'Could not load the leaderboard.'}
              </Text>
            ) : (
              <Text variant="muted">No members yet.</Text>
            )
          }
          refreshControl={
            <RefreshControl refreshing={board.isFetching && !board.isPending} onRefresh={() => void board.refetch()} />
          }
          renderItem={({ item }) => (
            <LeaderboardRow
              entry={item}
              isMe={item.userId === myUid}
              isLeader={item.userId === group?.ownerId}
              onTransfer={
                isOwner && item.userId !== myUid && !transfer.isPending ? () => confirmTransfer(item) : undefined
              }
            />
          )}
        />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: t.spacing.xl, gap: t.spacing.sm }}>
          <Text variant="heading">Global leaderboard</Text>
          <Text variant="muted" style={{ textAlign: 'center' }}>
            Ranking across all groups is coming soon.
          </Text>
        </View>
      )}

      {/* Settings sheet — slides up from bottom as one body (was a transparent fade). */}
      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
        {/* Invite code lives at the top of the sheet — share-only affordance, fits with
            the other group settings. */}
        {group?.inviteCode ? (
          <View style={{ paddingVertical: t.spacing.xs, paddingHorizontal: t.spacing.sm, marginBottom: t.spacing.xs, gap: t.spacing.xs }}>
            <Text variant="muted">Invite code</Text>
            <View
              style={{
                alignSelf: 'flex-start',
                backgroundColor: t.colors.primarySoft,
                borderRadius: t.radius.md,
                paddingHorizontal: t.spacing.md,
                paddingVertical: t.spacing.sm,
              }}
            >
              <Text selectable style={{ fontSize: t.fontSize.lg, fontWeight: '700', color: t.colors.primary, letterSpacing: 1.5 }}>
                {group.inviteCode}
              </Text>
            </View>
            <Text variant="caption">Tap &amp; hold to copy.</Text>
          </View>
        ) : null}

        {isOwner ? (
          <>
            <BottomSheetMenuItem
              label="Edit group"
              onPress={() => {
                setMenuOpen(false);
                router.push(`/group/${id}/edit` as Href);
              }}
            />
            <BottomSheetMenuItem
              label={archive.isPending ? 'Archiving…' : 'Archive group'}
              destructive
              onPress={() => {
                setMenuOpen(false);
                confirmArchive();
              }}
            />
          </>
        ) : null}
        <BottomSheetMenuItem
          label={leave.isPending ? 'Leaving…' : 'Leave group'}
          destructive
          onPress={() => {
            setMenuOpen(false);
            confirmLeave();
          }}
        />
        <BottomSheetMenuItem
          label="Report group"
          onPress={() => {
            setMenuOpen(false);
            setReportOpen(true);
          }}
        />
        <BottomSheetMenuItem label="Cancel" onPress={() => setMenuOpen(false)} />
      </BottomSheet>

      {id ? (
        <ReportSheet
          visible={reportOpen}
          onClose={() => setReportOpen(false)}
          targetType="group"
          targetId={id}
          targetLabel="this group"
        />
      ) : null}
    </Screen>
  );
}

function GroupChallengeRow({
  challenge,
  onPress,
}: {
  challenge: Challenge;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.spacing.md,
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="subtitle" numberOfLines={1}>
              {challenge.title}
            </Text>
            <Text variant="muted">
              {challenge.category} · {challenge.durationDays} days
            </Text>
          </View>
          <Text variant="muted">›</Text>
        </View>
      </Card>
    </Pressable>
  );
}

function LeaderboardRow({
  entry,
  isMe,
  isLeader,
  onTransfer,
}: {
  entry: LeaderboardEntry;
  isMe: boolean;
  isLeader: boolean;
  onTransfer?: () => void;
}) {
  const t = useTheme();
  const name = entry.displayName || entry.username || 'Member';
  const card = (
    <Card style={isMe ? { borderWidth: 1.5, borderColor: t.colors.accent } : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
        <Text variant="title" style={{ width: 44, color: t.colors.mutedForeground }}>
          {entry.rank}
        </Text>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}>
          {isLeader ? <CrownIcon size={14} /> : null}
          <Text variant="heading">
            {name}
            {isMe ? <Text variant="muted">  (You)</Text> : null}
          </Text>
        </View>
        <Text variant="heading">{entry.verifiedCount}</Text>
        <Text variant="muted">proofs</Text>
      </View>
    </Card>
  );
  if (onTransfer) {
    return (
      <Pressable accessibilityRole="button" accessibilityHint="Transfer leadership" onPress={onTransfer}>
        {card}
      </Pressable>
    );
  }
  return card;
}
