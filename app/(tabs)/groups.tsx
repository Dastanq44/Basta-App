import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { Card, Screen, Text, useTheme } from '@/shared/ui';
import { useMyGroups } from '@/features/groups';
import type { Group } from '@/entities';

// Thin route: lists the user's groups; tapping one opens its leaderboard (group/[id]).
export default function GroupsScreen() {
  const t = useTheme();
  const router = useRouter();
  const groups = useMyGroups();

  return (
    <Screen padded={false} edges={['top']}>
      <FlatList
        data={groups.data ?? []}
        keyExtractor={(g) => g.id}
        contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.md }}
        ListHeaderComponent={<Text variant="title" style={{ marginBottom: t.spacing.sm }}>Groups</Text>}
        ListEmptyComponent={
          groups.isPending ? null : (
            <Text variant="muted">
              You’re not in any groups yet. Create or join one during onboarding, or ask a friend
              for an invite code.
            </Text>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={groups.isFetching && !groups.isPending}
            onRefresh={() => void groups.refetch()}
          />
        }
        renderItem={({ item }) => (
          // typedRoutes may not have generated group/[id] in the route union yet; the resolved
          // string href is what expo-router navigates with.
          <GroupRow group={item} onPress={() => router.push(`/group/${item.id}` as Href)} />
        )}
      />
    </Screen>
  );
}

function GroupRow({ group, onPress }: { group: Group; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="heading">{group.name}</Text>
          <Text variant="muted">View leaderboard ›</Text>
        </View>
      </Card>
    </Pressable>
  );
}
