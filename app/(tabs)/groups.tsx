import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { Avatar, BrandEmptyState, Button, Card, Icon, Screen, Text, useTheme } from '@/shared/ui';
import { useI18n } from '@/shared/i18n';
import { type GroupListItem, useMyArchivedGroups, useMyGroups } from '@/features/groups';

// Thin route: lists the user's active groups, with create/join CTAs and a link to archived
// groups. Tapping a row opens its leaderboard (group/[id]).
export default function GroupsScreen() {
  const t = useTheme();
  const router = useRouter();
  const { t: tr } = useI18n();
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
            <Text variant="title">{tr('nav.groups')}</Text>
            {/* One primary (create) + one secondary (join) — no competing duplicate CTAs. */}
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button
                  label={tr('groups.newGroup')}
                  icon={<Icon name="plus" size={15} color={t.colors.primaryForeground} />}
                  onPress={() => goCreateOrJoin('create')}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button label={tr('common.joinWithCode')} variant="secondary" onPress={() => goCreateOrJoin('join')} />
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
            <BrandEmptyState
              title={tr('groups.empty')}
              body={tr('groups.emptyBody')}
              actionLabel={tr('groups.newGroup')}
              onAction={() => goCreateOrJoin('create')}
            />
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
          // Archived = a softer settings/archive destination: a quiet outlined row, not a CTA.
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr('groups.archived')}
            onPress={goArchived}
            hitSlop={4}
            style={({ pressed }) => ({
              marginTop: t.spacing.lg,
              flexDirection: 'row',
              alignItems: 'center',
              gap: t.spacing.sm,
              paddingVertical: t.spacing.sm,
              paddingHorizontal: t.spacing.md,
              borderRadius: t.radius.lg,
              borderWidth: 1,
              borderColor: t.colors.border,
              backgroundColor: 'transparent',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Icon name="settings" size={16} color={t.colors.mutedForeground} />
            <Text variant="caption" style={{ flex: 1 }}>
              {tr('groups.archived')}{archivedCount > 0 ? ` · ${archivedCount}` : ''}
            </Text>
            <Icon name="chevron" size={14} color={t.colors.mutedForeground} />
          </Pressable>
        }
      />
    </Screen>
  );
}

function GroupRow({ group, onPress }: { group: GroupListItem; onPress: () => void }) {
  const t = useTheme();
  const { t: tr } = useI18n();
  const memberLabel =
    group.memberCount === 1 ? tr('groups.memberCountOne') : tr('groups.memberCount', { count: group.memberCount });
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={group.name}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
          <Avatar name={group.name} uri={group.avatarUrl} size={48} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text variant="subtitle" numberOfLines={1}>
              {group.name}
            </Text>
            {group.description ? (
              <Text variant="caption" numberOfLines={1}>{group.description}</Text>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
              <Text variant="label" style={{ color: t.colors.primary }}>{memberLabel}</Text>
              <Text variant="label" style={{ color: t.colors.mutedForeground }}>
                · {group.isPublic ? tr('groups.publicGroup') : tr('groups.privateGroup')}
              </Text>
            </View>
          </View>
          <Icon name="chevron" size={18} color={t.colors.mutedForeground} />
        </View>
      </Card>
    </Pressable>
  );
}
