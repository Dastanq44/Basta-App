import { Alert, FlatList, RefreshControl, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, Screen, Text, useTheme } from '@/shared/ui';
import { useSession } from '@/features/auth';
import { useArchiveGroup, useLeaveGroup, useMyGroups } from '@/features/groups';
import { useGroupLeaderboard } from '@/features/leaderboard';
import type { LeaderboardEntry } from '@/entities';

// Thin route: group name + invite code to share + the server-authoritative leaderboard.
export default function GroupScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession();
  const myUid = session.session?.user.id;
  const groups = useMyGroups();
  const board = useGroupLeaderboard(id);
  const leave = useLeaveGroup();
  const archive = useArchiveGroup();

  const group = groups.data?.find((g) => g.id === id);
  const isOwner = !!myUid && group?.ownerId === myUid;

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

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ title: group?.name ?? 'Group' }} />
      <FlatList
        data={board.data ?? []}
        keyExtractor={(e) => e.userId}
        contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.sm, paddingBottom: t.spacing.xl }}
        ListHeaderComponent={
          <View style={{ gap: t.spacing.md, marginBottom: t.spacing.sm }}>
            {group?.inviteCode ? (
              <Card>
                <Text variant="muted">Invite code</Text>
                <Text variant="title" style={{ letterSpacing: 1 }}>{group.inviteCode}</Text>
                <Text variant="caption">Share this so a friend can join the group.</Text>
              </Card>
            ) : null}
            <Text variant="heading">Leaderboard</Text>
          </View>
        }
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
          <RefreshControl
            refreshing={board.isFetching && !board.isPending}
            onRefresh={() => void board.refetch()}
          />
        }
        renderItem={({ item }) => <LeaderboardRow entry={item} isMe={item.userId === myUid} />}
        ListFooterComponent={
          <View style={{ marginTop: t.spacing.lg, gap: t.spacing.sm }}>
            <Text variant="heading">Settings</Text>
            <Button
              label={leave.isPending ? 'Leaving…' : 'Leave group'}
              variant="secondary"
              onPress={confirmLeave}
              loading={leave.isPending}
              disabled={leave.isPending || archive.isPending}
            />
            {isOwner ? (
              <Button
                label={archive.isPending ? 'Archiving…' : 'Archive group'}
                variant="destructive"
                onPress={confirmArchive}
                loading={archive.isPending}
                disabled={leave.isPending || archive.isPending}
              />
            ) : null}
          </View>
        }
      />
    </Screen>
  );
}

function LeaderboardRow({ entry, isMe }: { entry: LeaderboardEntry; isMe: boolean }) {
  const t = useTheme();
  const name = entry.displayName || entry.username || 'Member';
  return (
    <Card style={isMe ? { borderWidth: 1.5, borderColor: t.colors.accent } : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
        <Text variant="title" style={{ width: 44, color: t.colors.mutedForeground }}>{entry.rank}</Text>
        <View style={{ flex: 1 }}>
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
}
