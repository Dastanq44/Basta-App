import { FlatList, RefreshControl, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Card, Screen, Text, useTheme } from '@/shared/ui';
import { useSession } from '@/features/auth';
import { useMyGroups } from '@/features/groups';
import { useGroupLeaderboard } from '@/features/leaderboard';
import type { LeaderboardEntry } from '@/entities';

// Thin route: group name + invite code to share + the server-authoritative leaderboard.
export default function GroupScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession();
  const myUid = session.session?.user.id;
  const groups = useMyGroups();
  const board = useGroupLeaderboard(id);

  const group = groups.data?.find((g) => g.id === id);

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
