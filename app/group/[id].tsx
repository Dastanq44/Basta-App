import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, FlatList, Image, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Avatar,
  BottomSheet,
  BottomSheetMenuItem,
  Button,
  Card,
  CrownIcon,
  Icon,
  Screen,
  ScreenHeader,
  SegmentedControl,
  Text,
  useTheme,
} from '@/shared/ui';
import { useSession } from '@/features/auth';
import { useChallenges } from '@/features/challenges';
import {
  PublicGroupPreview,
  useArchiveGroup,
  useGroupAccess,
  useGroupOverview,
  useLeaveGroup,
  useMyGroups,
  useTransferGroupLeadership,
} from '@/features/groups';
import { useGroupLeaderboard } from '@/features/leaderboard';
import { ReportSheet } from '@/features/moderation';
import { userAvatarUrl } from '@/features/onboarding';
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
  // Resolve access first. In public-preview mode the member-only hooks are DISABLED by passing
  // `undefined` (they gate on `enabled: !!id`), so no member-only RPC runs for a public viewer.
  const access = useGroupAccess(id);
  const memberId = access.data?.accessMode === 'member' ? id : undefined;
  const groups = useMyGroups();
  const overview = useGroupOverview(memberId);
  const board = useGroupLeaderboard(memberId);
  const challenges = useChallenges();
  const leave = useLeaveGroup();
  const archive = useArchiveGroup();
  const transfer = useTransferGroupLeadership();
  const [tab, setTab] = useState<Tab>('main');
  const [menuOpen, setMenuOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  // Auto-fading "Copied to clipboard" chip that lives at the top of the settings sheet.
  // No tap dismiss; the timer below handles the lifecycle. Replaces the prior
  // Alert.alert("Copied", ...) which fully covered the screen.
  const [toastVisible, setToastVisible] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!toastVisible) return;
    Animated.timing(toastOpacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(toastOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(
        ({ finished }) => {
          if (finished) setToastVisible(false);
        },
      );
    }, 900);
    return () => clearTimeout(timer);
  }, [toastVisible, toastOpacity]);

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

  // Access gate (runs before the member-data guards below).
  if (access.isPending) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader title="Group" onBack={() => router.back()} />
        <Text variant="muted">Loading…</Text>
      </Screen>
    );
  }
  if (access.isError || !access.data) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader title="Group" onBack={() => router.back()} />
        <View style={{ gap: t.spacing.md }}>
          <Text variant="title">Group unavailable</Text>
          <Text variant="muted">This group is private, archived, or no longer exists.</Text>
        </View>
      </Screen>
    );
  }
  if (access.data.accessMode === 'public') {
    return <PublicGroupPreview access={access.data} />;
  }

  // ── Member detail from here. ──
  if (!groups.isPending && !group) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ScreenHeader title="Group" onBack={() => router.back()} />
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
    <Screen padded={false} edges={['top', 'bottom']}>
      {/* Custom in-body header — replaces the native UINavigationBar so the bar-button
          system tap-highlight ("white circle behind the icons") never renders. */}
      <ScreenHeader
        title={group?.name ?? 'Group'}
        onBack={() => router.back()}
        rightAction={{
          icon: <Icon name="settings" size={22} color={t.colors.foreground} />,
          onPress: () => setMenuOpen(true),
          accessibilityLabel: 'Group settings',
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
              // iOS doesn't always clip a raw <Image> by its own borderRadius. Wrapping in
              // a View with overflow:'hidden' guarantees the image is fully clipped to the
              // circle (otherwise the top corners of the source bitmap can poke past the
              // rounded mask — what was reading as the avatar being "half cut on top").
              <View
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 44,
                  overflow: 'hidden',
                  backgroundColor: t.colors.muted,
                }}
              >
                <Image
                  source={{ uri: overview.data.avatarUrl }}
                  style={{ width: 88, height: 88 }}
                  resizeMode="cover"
                />
              </View>
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
              onPress={() => {
                if (item.userId === myUid) {
                  router.push('/(tabs)/profile' as Href);
                } else {
                  router.push(`/user/${item.userId}` as Href);
                }
              }}
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
        {/* Auto-fading "Copied to clipboard" toast. Floats ABOVE the sheet's top edge
            via position:absolute + a negative top offset. The sheet's container is the
            transform-anchored parent, so this Animated.View moves with the sheet during
            the slide-in animation while sitting outside the sheet's content area. Bright
            primary palette + a soft shadow so it reads as a separate notification, not a
            sheet menu item. Non-interactive (pointerEvents='none'). */}
        {toastVisible ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -56,
              left: 0,
              right: 0,
              alignItems: 'center',
              opacity: toastOpacity,
            }}
          >
            <View
              style={{
                backgroundColor: t.colors.card,
                paddingHorizontal: t.spacing.md,
                paddingVertical: 8,
                borderRadius: t.radius.full,
                borderWidth: 1,
                borderColor: t.colors.border,
                shadowColor: '#000',
                shadowOpacity: 0.12,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 },
                elevation: 4,
              }}
            >
              <Text style={{ color: t.colors.mutedForeground, fontSize: t.fontSize.sm, fontWeight: '600' }}>
                Copied to clipboard
              </Text>
            </View>
          </Animated.View>
        ) : null}

        {/* Invite code — centered, tap-to-copy. The whole chip is a Pressable so the
            invite acts as one big button. setStringAsync writes to the system clipboard
            via expo-clipboard; a quick Alert confirms so the user knows it worked. */}
        {group?.inviteCode ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tap to copy invite code"
            onPress={async () => {
              if (!group.inviteCode) return;
              try {
                await Clipboard.setStringAsync(group.inviteCode);
                // Non-blocking toast inside the sheet (see effect at top of file).
                // Restarting the timer on re-tap: drop visibility first so the effect
                // re-runs cleanly even when already visible.
                setToastVisible(false);
                setTimeout(() => setToastVisible(true), 0);
              } catch (e) {
                Alert.alert('Could not copy', e instanceof Error ? e.message : 'Unknown error');
              }
            }}
            style={({ pressed }) => ({
              alignItems: 'center',
              paddingVertical: t.spacing.xs,
              paddingHorizontal: t.spacing.sm,
              marginBottom: t.spacing.xs,
              opacity: pressed ? 0.6 : 1,
              gap: t.spacing.xs,
            })}
          >
            <Text variant="muted">Invite code</Text>
            <View
              style={{
                backgroundColor: t.colors.primarySoft,
                borderRadius: t.radius.md,
                paddingHorizontal: t.spacing.md,
                paddingVertical: t.spacing.sm,
              }}
            >
              <Text style={{ fontSize: t.fontSize.lg, fontWeight: '700', color: t.colors.primary, letterSpacing: 1.5 }}>
                {group.inviteCode}
              </Text>
            </View>
            <Text variant="caption">Tap to copy.</Text>
          </Pressable>
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
              label="Transfer leadership"
              onPress={() => {
                setMenuOpen(false);
                setTransferOpen(true);
              }}
            />
            {/* Archive sits in the owner block but is rendered in the default (foreground)
                tone, not the destructive red — per the user's request. The Alert.alert
                confirmation downstream still describes the consequence clearly. */}
            <BottomSheetMenuItem
              label={archive.isPending ? 'Archiving…' : 'Archive group'}
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
        {/* Report group is only useful for non-owners. The leader can't usefully report
            their own group, so hide the affordance for them. */}
        {isOwner ? null : (
          <BottomSheetMenuItem
            label="Report group"
            onPress={() => {
              setMenuOpen(false);
              setReportOpen(true);
            }}
          />
        )}
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

      <TransferLeadershipSheet
        visible={transferOpen}
        onClose={() => setTransferOpen(false)}
        members={(board.data ?? []).filter((m) => m.userId !== myUid)}
        pending={transfer.isPending}
        onPick={(entry) => {
          setTransferOpen(false);
          confirmTransfer(entry);
        }}
      />
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
  onPress,
}: {
  entry: LeaderboardEntry;
  isMe: boolean;
  isLeader: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const name = entry.displayName || entry.username || 'Member';
  const avatarRemoteUrl = userAvatarUrl(entry.avatarUrl ?? null);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={isMe ? 'Open your profile' : "Open this member's profile"}
      onPress={onPress}
    >
      <Card style={isMe ? { borderWidth: 1.5, borderColor: t.colors.accent } : undefined}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
          <Text variant="title" style={{ width: 28, color: t.colors.mutedForeground, textAlign: 'center' }}>
            {entry.rank}
          </Text>
          {avatarRemoteUrl ? (
            <Image source={{ uri: avatarRemoteUrl }} style={{ width: 36, height: 36, borderRadius: 18 }} />
          ) : (
            <Avatar name={name} size={36} />
          )}
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text variant="heading" numberOfLines={1}>
              {name}
              {isMe ? <Text variant="muted">  (You)</Text> : null}
            </Text>
            {isLeader ? <CrownIcon size={14} /> : null}
          </View>
          <Text variant="heading">{entry.verifiedCount}</Text>
          <Text variant="muted">proofs</Text>
        </View>
      </Card>
    </Pressable>
  );
}

function TransferLeadershipSheet({
  visible,
  onClose,
  members,
  pending,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  members: LeaderboardEntry[];
  pending: boolean;
  onPick: (entry: LeaderboardEntry) => void;
}) {
  const t = useTheme();
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ gap: t.spacing.sm, paddingBottom: t.spacing.xs }}>
        <Text variant="heading">Transfer leadership</Text>
        <Text variant="muted">
          Pick the member who should become the new leader. You&apos;ll be asked to confirm.
        </Text>
        {members.length === 0 ? (
          <Text variant="muted">No other members to transfer to.</Text>
        ) : (
          members.map((m) => {
            const name = m.displayName || m.username || 'Member';
            const avatarRemoteUrl = userAvatarUrl(m.avatarUrl ?? null);
            return (
              <Pressable
                key={m.userId}
                accessibilityRole="button"
                accessibilityLabel={`Make ${name} the leader`}
                disabled={pending}
                onPress={() => onPick(m)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: t.spacing.sm,
                  paddingVertical: t.spacing.sm,
                  paddingHorizontal: t.spacing.sm,
                  borderRadius: t.radius.md,
                  backgroundColor: t.colors.muted,
                  opacity: pending ? 0.6 : 1,
                }}
              >
                {avatarRemoteUrl ? (
                  <Image source={{ uri: avatarRemoteUrl }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                ) : (
                  <Avatar name={name} size={36} />
                )}
                <Text variant="body" style={{ flex: 1 }}>{name}</Text>
                <Text variant="muted">›</Text>
              </Pressable>
            );
          })
        )}
      </View>
    </BottomSheet>
  );
}
