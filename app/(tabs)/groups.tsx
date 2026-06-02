import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { Button, Card, Screen, Text, useTheme } from '@/shared/ui';
import { useMyArchivedGroups, useMyGroups } from '@/features/groups';
import type { Group } from '@/entities';

// Thin route: lists the user's active groups, with create/join CTAs and a link to archived
// groups. Tapping a row opens its leaderboard (group/[id]).
export default function GroupsScreen() {
  const t = useTheme();
  const router = useRouter();
  const groups = useMyGroups();
  const archived = useMyArchivedGroups();
  const archivedCount = archived.data?.length ?? 0;

  // typedRoutes hasn't generated these new paths yet; cast string hrefs.
  const goCreateOrJoin = (mode: 'create' | 'join') =>
    router.push((`/group/join-or-create?mode=${mode}`) as Href);
  const goArchived = () => router.push('/group/archived' as Href);
  const openGroup = (id: string) => router.push(`/group/${id}` as Href);

  return (
    <Screen padded={false} edges={['top']}>
      <FlatList
        data={groups.data ?? []}
        keyExtractor={(g) => g.id}
        contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.md, paddingBottom: t.spacing.xl }}
        ListHeaderComponent={
          <View style={{ gap: t.spacing.md, marginBottom: t.spacing.sm }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text variant="title">Groups</Text>
              <Button label="+ New" size="sm" onPress={() => goCreateOrJoin('create')} />
            </View>
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button
                  label="Create group"
                  variant="secondary"
                  size="sm"
                  onPress={() => goCreateOrJoin('create')}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="Join with code"
                  variant="secondary"
                  size="sm"
                  onPress={() => goCreateOrJoin('join')}
                />
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          groups.isPending ? null : groups.isError ? (
            <Text variant="caption" style={{ color: t.colors.destructive }}>
              {groups.error instanceof Error ? groups.error.message : 'Could not load groups.'}
            </Text>
          ) : (
            <Card>
              <View style={{ gap: t.spacing.xs }}>
                <Text variant="heading">No groups yet</Text>
                <Text variant="muted">
                  Tap "Create group" to start your own, or "Join with code" if a friend has
                  shared an invite.
                </Text>
              </View>
            </Card>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={groups.isFetching && !groups.isPending}
            onRefresh={() => {
              void groups.refetch();
              void archived.refetch();
            }}
          />
        }
        renderItem={({ item }) => <GroupRow group={item} onPress={() => openGroup(item.id)} />}
        ListFooterComponent={
          <View style={{ marginTop: t.spacing.lg, gap: t.spacing.sm }}>
            <Pressable accessibilityRole="button" onPress={goArchived} hitSlop={4}>
              <Text variant="muted" style={{ textAlign: 'center' }}>
                Archived groups{archivedCount > 0 ? ` (${archivedCount})` : ''} ›
              </Text>
            </Pressable>
          </View>
        }
      />
    </Screen>
  );
}

function GroupRow({ group, onPress }: { group: Group; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Text variant="heading">{group.name}</Text>
          <Text variant="muted">View leaderboard ›</Text>
        </View>
      </Card>
    </Pressable>
  );
}
