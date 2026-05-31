import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Button, Card, Screen, Text, useTheme } from '@/shared/ui';
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
          <Button label="+ New" size="sm" onPress={() => router.push('/challenge/new')} />
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
          <View style={{ gap: t.spacing.xs }}>
            <Text variant="heading">{challenge.title}</Text>
            <Text variant="muted">
              {challenge.category} · {challenge.mode} · {challenge.durationDays} days
            </Text>
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}
