import { Alert, FlatList, RefreshControl, View } from 'react-native';
import { Stack } from 'expo-router';
import { Button, Card, Screen, Text, useTheme } from '@/shared/ui';
import { useI18n } from '@/shared/i18n';
import { useSession } from '@/features/auth';
import { useMyArchivedGroups, useRestoreGroup } from '@/features/groups';
import type { Group } from '@/entities';

// Thin route: lists groups archived by their owner. Owners see a Restore button per row.
// Non-owners (any member who hasn't left) see the row read-only.
export default function ArchivedGroupsScreen() {
  const t = useTheme();
  const { t: tr } = useI18n();
  const session = useSession();
  const myUid = session.session?.user.id;
  const archived = useMyArchivedGroups();
  const restore = useRestoreGroup();

  const confirmRestore = (groupId: string) => {
    Alert.alert(
      tr('archived.restoreTitle'),
      tr('archived.restoreBody'),
      [
        { text: tr('common.cancel'), style: 'cancel' },
        {
          text: tr('archived.restore'),
          onPress: () =>
            restore.mutate(groupId, {
              onError: (e: unknown) =>
                Alert.alert(tr('archived.couldNotRestore'), e instanceof Error ? e.message : tr('common.error')),
            }),
        },
      ],
      { cancelable: true },
    );
  };

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ title: tr('groups.archived') }} />
      <FlatList
        data={archived.data ?? []}
        keyExtractor={(g) => g.id}
        contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.md, paddingBottom: t.spacing.xl }}
        ListEmptyComponent={
          archived.isPending ? (
            <Text variant="muted">{tr('common.loading')}</Text>
          ) : archived.isError ? (
            <Text variant="caption" style={{ color: t.colors.destructive }}>
              {archived.error instanceof Error ? archived.error.message : tr('archived.loadError')}
            </Text>
          ) : (
            <Text variant="muted">{tr('archived.empty')}</Text>
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
  const { t: tr, fmtDate } = useI18n();
  return (
    <Card>
      <View style={{ gap: t.spacing.xs }}>
        <Text variant="heading">{group.name}</Text>
        {group.archivedAt ? (
          <Text variant="caption">{tr('archived.on', { date: fmtDate(group.archivedAt) })}</Text>
        ) : null}
        {isOwner ? (
          <View style={{ marginTop: t.spacing.sm }}>
            <Button
              label={restoring ? tr('archived.restoring') : tr('archived.restore')}
              variant="secondary"
              size="sm"
              onPress={onRestore}
              loading={restoring}
              disabled={restoring}
            />
          </View>
        ) : (
          <Text variant="caption">{tr('archived.onlyOwner')}</Text>
        )}
      </View>
    </Card>
  );
}
