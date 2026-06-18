import { useCallback } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Text, useTheme } from '@/shared/ui';
import { GlobalFeedCard, useGlobalFeed } from '@/features/global';
import type { GlobalPost } from '@/entities';

// Global tab (route kept as "explore" to avoid navigation churn — visible title is "Global").
// v1: a chronological feed of PUBLIC, VERIFIED submissions. Server enforces visibility; this
// screen never filters for privacy. No challenge/group/profile discovery, no ranking. Thin route:
// data via useGlobalFeed, layout + nav bindings only.
export default function GlobalScreen() {
  const t = useTheme();
  const router = useRouter();
  const feed = useGlobalFeed();

  const posts: GlobalPost[] = feed.data?.pages.flat() ?? [];
  // Don't show the pull-spinner while paginating (that has its own footer spinner).
  const refreshing = feed.isRefetching && !feed.isFetchingNextPage;

  const onRefresh = useCallback(() => {
    void feed.refetch();
  }, [feed]);

  const onEndReached = useCallback(() => {
    if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
  }, [feed]);

  const renderItem = useCallback(
    ({ item }: { item: GlobalPost }) => (
      <GlobalFeedCard
        post={item}
        onPress={() => router.push({ pathname: '/submission/[id]', params: { id: item.id } })}
        onPressAuthor={() => router.push({ pathname: '/user/[id]', params: { id: item.authorId } })}
      />
    ),
    [router],
  );

  return (
    <Screen edges={['top']} padded={false}>
      <View style={{ paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.sm }}>
        <Text variant="title">Global</Text>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        renderItem={renderItem}
        contentContainerStyle={{
          paddingHorizontal: t.spacing.lg,
          paddingBottom: t.spacing.xxl,
          gap: t.spacing.md,
          flexGrow: 1,
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          feed.isPending ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: t.spacing.xxl }}>
              <ActivityIndicator color={t.colors.primary} />
            </View>
          ) : feed.isError ? (
            <EmptyState
              title="Couldn't load Global"
              body="Something went wrong. Pull down to try again."
            />
          ) : (
            <EmptyState
              title="No public submissions yet"
              body="When people share verified proofs to Global from public profiles and challenges, they'll show up here."
            />
          )
        }
        ListFooterComponent={
          feed.isFetchingNextPage ? (
            <View style={{ paddingVertical: t.spacing.lg }}>
              <ActivityIndicator color={t.colors.primary} />
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.spacing.sm, paddingTop: t.spacing.xxl, paddingHorizontal: t.spacing.lg }}>
      <Text variant="heading" style={{ textAlign: 'center' }}>{title}</Text>
      <Text variant="muted" style={{ textAlign: 'center' }}>{body}</Text>
    </View>
  );
}
