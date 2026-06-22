import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { Avatar, Button, Card, Icon, Screen, Text, useTheme } from '@/shared/ui';
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
            <Text variant="title">Groups</Text>
            {/* One primary (create) + one secondary (join) — no competing duplicate CTAs. */}
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button
                  label="New group"
                  icon={<Icon name="plus" size={15} color={t.colors.primaryForeground} />}
                  onPress={() => goCreateOrJoin('create')}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Join with code" variant="secondary" onPress={() => goCreateOrJoin('join')} />
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
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
          <Avatar name={group.name} size={44} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="subtitle" numberOfLines={1}>
              {group.name}
            </Text>
            <Text variant="caption" style={{ color: t.colors.mutedForeground }}>
              {group.isPublic ? 'Public group' : 'Private group'}
            </Text>
          </View>
          <Icon name="chevron" size={18} color={t.colors.mutedForeground} />
        </View>
      </Card>
    </Pressable>
  );
}
