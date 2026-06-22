import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BrandEmptyState, Button, Icon, Screen, SegmentedControl, Text, useTheme } from '@/shared/ui';
import { useI18n } from '@/shared/i18n';
import { ChallengeRow, useChallenges } from '@/features/challenges';
import type { Challenge } from '@/entities';

type Tab = 'active' | 'finished';

// Thin route — Active/Finished tabs + create CTA + empty state. Item taps navigate to
// /challenge/:id. Active vs Finished is split by local date relative to start_date +
// duration_days. Archived challenges are excluded server-side from useChallenges.
export default function ChallengesTab() {
  const t = useTheme();
  const router = useRouter();
  const { t: tr } = useI18n();
  const { data, isPending, isError, error, refetch, isFetching } = useChallenges();
  const [tab, setTab] = useState<Tab>('active');

  const { active, finished } = useMemo(() => {
    const a: Challenge[] = [];
    const f: Challenge[] = [];
    const todayTs = localMidnightTs(new Date());
    for (const c of data ?? []) {
      const startTs = parseLocalMidnight(c.startDate);
      if (startTs == null) {
        a.push(c);
        continue;
      }
      // The challenge runs days 0..durationDays-1 from startDate. It finishes the
      // moment today's local midnight passes startDate + durationDays days.
      const endTs = startTs + c.durationDays * 86_400_000;
      if (todayTs >= endTs) f.push(c);
      else a.push(c);
    }
    return { active: a, finished: f };
  }, [data]);

  const visible = tab === 'active' ? active : finished;

  return (
    <Screen padded={false}>
      <View style={{ padding: t.spacing.lg, gap: t.spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="title">{tr('nav.challenges')}</Text>
          <Button
            label={tr('common.new')}
            size="sm"
            icon={<Icon name="plus" size={15} color={t.colors.primaryForeground} />}
            onPress={() => router.push('/challenge/new')}
          />
        </View>
        <SegmentedControl
          options={[
            { label: `${tr('challenges.active')} · ${active.length}`, value: 'active' },
            { label: `${tr('challenges.finished')} · ${finished.length}`, value: 'finished' },
          ]}
          value={tab}
          onChange={setTab}
        />
        {isError ? (
          <Text variant="caption" style={{ color: t.colors.destructive }}>
            {error instanceof Error ? error.message : 'Could not load challenges.'}
          </Text>
        ) : null}
      </View>
      <FlatList
        data={visible}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.xl, gap: t.spacing.md }}
        ListEmptyComponent={
          !isPending ? (
            tab === 'active' ? (
              <BrandEmptyState
                title={tr('challenges.empty')}
                body={tr('challenges.emptyBody')}
                actionLabel={tr('today.newChallenge')}
                onAction={() => router.push('/challenge/new')}
              />
            ) : (
              <BrandEmptyState
                title="No finished challenges yet"
                body="Past challenges show up here once they end. Keep your active ones running to build a track record."
                tone={t.colors.mutedForeground}
              />
            )
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

// Day math helpers. We compare timestamps of LOCAL midnight — both values share the same
// timezone offset so subtraction gives a tz-correct delta. Strict tz semantics (the
// challenge_day server math) doesn't matter here; we only need the "did the local
// calendar pass the end day" question, which the user sees in their phone's clock.

function parseLocalMidnight(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
}
function localMidnightTs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
