import { Alert, FlatList, View } from 'react-native';
import { Stack } from 'expo-router';
import { Button, Card, Screen, Text, useTheme } from '@/shared/ui';
import { useMyBlocks, useUnblockUser } from '@/features/moderation';
import type { Block } from '@/entities';

// Thin route — list of users the current viewer has blocked + Unblock button per row.
// The `blocks` table doesn't store profile info, so for MVP we render the user id (a UUID)
// as the fallback identifier. Profile-name resolution can be added later via a SECURITY
// DEFINER RPC that returns minimal display info for a list of ids.
export default function BlockedUsersScreen() {
  const blocks = useMyBlocks();
  const t = useTheme();

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ title: 'Blocked users' }} />
      <FlatList
        data={blocks.data ?? []}
        keyExtractor={(b) => b.blockedId}
        contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.md, paddingBottom: t.spacing.xl }}
        ListEmptyComponent={
          blocks.isPending ? (
            <Text variant="muted">Loading…</Text>
          ) : blocks.isError ? (
            <Text variant="caption" style={{ color: t.colors.destructive }}>
              {blocks.error instanceof Error ? blocks.error.message : 'Could not load blocked users.'}
            </Text>
          ) : (
            <Text variant="muted">
              You haven't blocked anyone. Use "Block author" on a proof to add someone here.
            </Text>
          )
        }
        renderItem={({ item }) => <BlockedRow block={item} />}
        refreshing={blocks.isFetching && !blocks.isPending}
        onRefresh={() => void blocks.refetch()}
      />
    </Screen>
  );
}

function BlockedRow({ block }: { block: Block }) {
  const t = useTheme();
  const unblock = useUnblockUser();

  const confirmUnblock = () => {
    Alert.alert(
      'Unblock this user?',
      "You'll see their proofs, comments, and reactions again.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: () =>
            unblock.mutate(block.blockedId, {
              onError: (e: unknown) =>
                Alert.alert('Could not unblock', e instanceof Error ? e.message : 'Unknown error'),
            }),
        },
      ],
      { cancelable: true },
    );
  };

  return (
    <Card>
      <View style={{ gap: t.spacing.xs }}>
        <Text variant="muted">User id</Text>
        <Text variant="body" style={{ fontFamily: 'monospace' }}>
          {block.blockedId}
        </Text>
        <Text variant="caption">Blocked {new Date(block.createdAt).toLocaleDateString()}</Text>
        <View style={{ marginTop: t.spacing.sm }}>
          <Button
            label={unblock.isPending ? 'Unblocking…' : 'Unblock'}
            variant="secondary"
            size="sm"
            onPress={confirmUnblock}
            loading={unblock.isPending}
            disabled={unblock.isPending}
          />
        </View>
      </View>
    </Card>
  );
}
