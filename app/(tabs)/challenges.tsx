import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Button, Card, Icon, Screen, Text, useTheme } from '@/shared/ui';
import { useChallenges } from '@/features/challenges';
import type { Challenge } from '@/entities';

// Thin route — list + create CTA + empty state. Item taps navigate to /challenge/:id.
export default function ChallengesTab() {
  const t = useTheme();
  const router = useRouter();
  const { data, isPending, isError, error, refetch, isFetching } = useChallenges();

  return (
    <Screen padded={false}>
      <View style={{ padding: t.spacing.lg, gap: t.spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="title">Challenges</Text>
          <Button
            label="New"
            size="sm"
            icon={<Icon name="plus" size={15} color={t.colors.primaryForeground} />}
            onPress={() => router.push('/challenge/new')}
          />
        </View>
        {isError ? (
          <Text variant="caption" style={{ color: t.colors.destructive }}>
            {error instanceof Error ? error.message : 'Could not load challenges.'}
          </Text>
        ) : null}
      </View>
      <FlatList
        data={data ?? []}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.xl, gap: t.spacing.md }}
        ListEmptyComponent={
          !isPending ? (
            <View style={{ gap: t.spacing.sm }}>
              <Text variant="heading">No challenges yet</Text>
              <Text variant="muted">
                Create your first solo or group challenge. Daily proof keeps the streak alive.
              </Text>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl refreshing={isFetching && !isPending} onRefresh={() => void refetch()} />
        }
        renderItem={({ item }) => <ChallengeRow challenge={item} />}
      />
    </Screen>
  );
}

function ChallengeRow({ challenge }: { challenge: Challenge }) {
  const t = useTheme();
  return (
    <Link href={{ pathname: '/challenge/[id]', params: { id: challenge.id } }} asChild>
      <Pressable accessibilityRole="button">
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: t.colors.primarySoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="tasks" size={22} color={t.colors.primary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="subtitle" numberOfLines={1}>
                {challenge.title}
              </Text>
              <Text variant="caption">
                {challenge.category} · {challenge.mode} · {challenge.durationDays} days
              </Text>
            </View>
            <Icon name="chevron" size={18} color={t.colors.mutedForeground} />
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}
