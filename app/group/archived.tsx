import { Alert, FlatList, RefreshControl, View } from 'react-native';
import { Stack } from 'expo-router';
import { Button, Card, Screen, Text, useTheme } from '@/shared/ui';
import { useSession } from '@/features/auth';
import { useMyArchivedGroups, useRestoreGroup } from '@/features/groups';
import type { Group } from '@/entities';

// Thin route: lists groups archived by their owner. Owners see a Restore button per row.
// Non-owners (any member who hasn't left) see the row read-only.
export default function ArchivedGroupsScreen() {
  const t = useTheme();
  const session = useSession();
  const myUid = session.session?.user.id;
  const archived = useMyArchivedGroups();
  const restore = useRestoreGroup();

  const confirmRestore = (groupId: string) => {
    Alert.alert(
      'Restore this group?',
      'It will reappear in your active groups list. Members and history are preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: () =>
            restore.mutate(groupId, {
              onError: (e: unknown) =>
                Alert.alert('Could not restore', e instanceof Error ? e.message : 'Unknown error'),
            }),
        },
      ],
      { cancelable: true },
    );
  };

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ title: 'Archived groups' }} />
      <FlatList
        data={archived.data ?? []}
        keyExtractor={(g) => g.id}
        contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.md, paddingBottom: t.spacing.xl }}
        ListEmptyComponent={
          archived.isPending ? (
            <Text variant="muted">Loading…</Text>
          ) : archived.isError ? (
            <Text variant="caption" style={{ color: t.colors.destructive }}>
              {archived.error instanceof Error
                ? archived.error.message
                : 'Could not load archived groups.'}
            </Text>
          ) : (
            <Text variant="muted">
              No archived groups. Groups you archive from their settings will show up here.
            </Text>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={archived.isFetching && !archived.isPending}
            onRefresh={() => void archived.refetch()}
          />
        }
        renderItem={({ item }) => (
          <ArchivedRow
            group={item}
            isOwner={!!myUid && item.ownerId === myUid}
            restoring={restore.isPending}
            onRestore={() => confirmRestore(item.id)}
          />
        )}
      />
    </Screen>
  );
}

function ArchivedRow({
  group,
  isOwner,
  restoring,
  onRestore,
}: {
  group: Group;
  isOwner: boolean;
  restoring: boolean;
  onRestore: () => void;
}) {
  const t = useTheme();
  return (
    <Card>
      <View style={{ gap: t.spacing.xs }}>
        <Text variant="heading">{group.name}</Text>
        {group.archivedAt ? (
          <Text variant="caption">
            Archived {new Date(group.archivedAt).toLocaleDateString()}
          </Text>
        ) : null}
        {isOwner ? (
          <View style={{ marginTop: t.spacing.sm }}>
            <Button
              label={restoring ? 'Restoring…' : 'Restore group'}
              variant="secondary"
              size="sm"
              onPress={onRestore}
              loading={restoring}
              disabled={restoring}
            />
          </View>
        ) : (
          <Text variant="caption">Only the owner can restore this group.</Text>
        )}
      </View>
    </Card>
  );
}
