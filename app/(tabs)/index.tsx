import { useCallback, useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar, BrandEmptyState, Card, Icon, OrnamentDivider, ProgressBar, Screen, Text, useTheme } from '@/shared/ui';
import { useI18n } from '@/shared/i18n';
import { useSession } from '@/features/auth';
import { ChallengeRow, useChallenges } from '@/features/challenges';
import { useMyRecentSubmissions } from '@/features/proofs';
import { homeOverviewQueryKey, pendingVerificationsQueryKey, useHomeOverview } from '@/features/home';
import { useProfile, userAvatarUrl } from '@/features/onboarding';
import type { Challenge } from '@/entities';

// Today / Home tab: weekly progress + streak + today's task + a conditional "Verify a friend"
// button (only when group proofs await the caller). All numbers are server-authoritative (D-003);
// no fake XP/levels (D-006) — stats map to real streak / submission / verification data.
export default function TodayScreen() {
  const t = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const session = useSession();
  const { t: tr } = useI18n();
  const overview = useHomeOverview();
  const profile = useProfile();

  // Recompute on focus so midnight rollover / a just-cleared verification reflect immediately.
  useFocusEffect(
    useCallback(() => {
      void qc.invalidateQueries({ queryKey: homeOverviewQueryKey });
      void qc.invalidateQueries({ queryKey: pendingVerificationsQueryKey });
    }, [qc]),
  );

  // Greeting reads from the real profile. Display name first, then username, then the
  // email local-part as a fallback for a freshly-signed-in user whose profile hasn't
  // synced yet. Avatar uses the uploaded image when present, otherwise initials.
  const email = session.session?.user.email ?? '';
  const name =
    profile.data?.displayName?.trim() ||
    profile.data?.username ||
    (email ? email.split('@')[0] : '') ||
    'there';
  const avatarRemoteUrl = useMemo(
    () => userAvatarUrl(profile.data?.avatarUrl ?? null),
    [profile.data?.avatarUrl],
  );
  const o = overview.data;
  const weekPct = o ? Math.min(1, o.weekActiveDays / 7) : 0;
  const pending = o?.pendingVerifications ?? 0;

  // Today section — the actual challenges with no proof submitted yet for the user's
  // current challenge_day. Pulled client-side from useChallenges + useMyRecentSubmissions
  // to avoid a new RPC. challenge_day is computed locally per challenge (today's date
  // minus the challenge's start_date, in local midnight ms). Slight tz drift vs the
  // server's day-boundary math is acceptable here — only used for display, not scoring.
  const challenges = useChallenges();
  const recentSubmissions = useMyRecentSubmissions();
  const openToday: Challenge[] = useMemo(() => {
    if (!challenges.data || !recentSubmissions.data) return [];
    const todayTs = localMidnightTs(new Date());
    // (challenge_id : challenge_day) keys covered by some submission.
    const submitted = new Set<string>();
    for (const s of recentSubmissions.data) submitted.add(`${s.challengeId}:${s.challengeDay}`);
    const out: Challenge[] = [];
    for (const c of challenges.data) {
      const startTs = parseLocalMidnight(c.startDate);
      if (startTs == null) continue;
      const todayDay = Math.round((todayTs - startTs) / 86_400_000);
      // In-range: started, not finished.
      if (todayDay < 0 || todayDay >= c.durationDays) continue;
      if (submitted.has(`${c.id}:${todayDay}`)) continue;
      out.push(c);
    }
    return out;
  }, [challenges.data, recentSubmissions.data]);

  const onRefresh = useCallback(() => {
    void overview.refetch();
    void profile.refetch();
    void challenges.refetch();
    void recentSubmissions.refetch();
  }, [overview, profile, challenges, recentSubmissions]);

  const refreshing =
    (overview.isFetching && !overview.isPending) ||
    (challenges.isFetching && !challenges.isPending) ||
    (recentSubmissions.isFetching && !recentSubmissions.isPending);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? tr('today.greeting.morning') : hour < 18 ? tr('today.greeting.afternoon') : tr('today.greeting.evening');

  return (
    <Screen padded={false} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.lg, paddingBottom: t.spacing.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Hero summary — greeting + avatar, then inline streak + today status. A single
            compact card so the page opens with "who you are + where you stand" at a glance. */}
        <Card style={{ backgroundColor: t.colors.primarySoft, borderColor: t.colors.primary + '33', gap: t.spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go to profile"
              onPress={() => router.push('/(tabs)/profile' as Href)}
              hitSlop={6}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Avatar name={name} uri={avatarRemoteUrl} size={56} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text variant="caption" style={{ color: t.colors.foreground, opacity: 0.7 }}>{greeting}</Text>
              <Text numberOfLines={1} style={{ fontSize: t.fontSize.xl, fontWeight: '800', color: t.colors.foreground, lineHeight: t.fontSize.xl * 1.2, marginTop: 2 }}>
                {name}
              </Text>
            </View>
          </View>
          <OrnamentDivider />
          <View style={{ flexDirection: 'row', gap: t.spacing.md }}>
            <HeroStat
              emoji="🔥"
              value={String(o?.currentStreak ?? 0)}
              label={tr('today.streak')}
              tint={t.colors.streak}
              accessibilityLabel={`${tr('today.currentStreak')}: ${o?.currentStreak ?? 0}`}
            />
            <HeroStat
              emoji="✅"
              value={o ? `${o.todayDone}/${o.todayTotal}` : '0/0'}
              label={tr('today.dueToday')}
              tint={t.colors.success}
              accessibilityLabel={`${tr('today.doneToday')}: ${o ? `${o.todayDone}/${o.todayTotal}` : '0/0'}`}
            />
          </View>
        </Card>

        {/* Conditional: verify a friend */}
        {pending > 0 ? (
          <Pressable accessibilityRole="button" onPress={() => router.push('/verifications' as Href)}>
            <Card style={{ backgroundColor: t.colors.primary, borderColor: t.colors.primary }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Text variant="label" style={{ color: t.colors.primaryForeground, opacity: 0.85 }}>
                    NEEDS YOU
                  </Text>
                  <Text style={{ color: t.colors.primaryForeground, fontSize: t.fontSize.lg, fontWeight: '800', marginTop: 2 }}>
                    Verify a friend
                  </Text>
                  <Text style={{ color: t.colors.primaryForeground, opacity: 0.9, marginTop: 2 }}>
                    {pending} proof{pending > 1 ? 's' : ''} waiting for your approval.
                  </Text>
                </View>
                <Icon name="chevron" size={20} color={t.colors.primaryForeground} />
              </View>
            </Card>
          </Pressable>
        ) : null}

        {/* Today — list of active challenges where today's proof is still missing.
            Same row format as the Challenges tab so the two surfaces match. Empty
            states differentiate "nothing pending" from "no challenges at all". */}
        <View style={{ gap: t.spacing.sm }}>
          <Text variant="heading">{tr('today.dueToday')}</Text>
          {challenges.isPending || recentSubmissions.isPending ? (
            <Card>
              <Text variant="muted">{tr('common.loading')}</Text>
            </Card>
          ) : openToday.length > 0 ? (
            <View style={{ gap: t.spacing.md }}>
              {openToday.map((c) => (
                <ChallengeRow key={c.id} challenge={c} />
              ))}
            </View>
          ) : (challenges.data?.length ?? 0) > 0 ? (
            <BrandEmptyState
              title={tr('today.allDone')}
              body={tr('today.allDoneBody')}
              tone={t.colors.success}
            />
          ) : (
            <BrandEmptyState
              title={tr('today.noChallenges')}
              body={tr('today.noChallengesBody')}
              actionLabel={tr('today.newChallenge')}
              onAction={() => router.push('/challenge/new')}
            />
          )}
        </View>

        {/* This week — active-days progress, below the action-first Today section. */}
        <Card>
          <Text variant="label">{tr('today.thisWeek').toUpperCase()}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: t.spacing.xs }}>
            <Text
              style={{
                fontSize: t.fontSize.xxxl,
                fontWeight: '800',
                color: t.colors.foreground,
                lineHeight: t.fontSize.xxxl + 6,
                includeFontPadding: false,
              }}
            >
              {o?.weekActiveDays ?? 0}
            </Text>
            <Text variant="muted">/ 7 days active</Text>
          </View>
          <View style={{ marginTop: t.spacing.sm }}>
            <ProgressBar value={weekPct} height={10} />
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

/** Inline hero stat — an emoji badge in a tinted rounded tile + big value + caption. The emoji is
 *  a readability cue only; the label text stays visible and the whole tile carries an a11y label. */
function HeroStat({
  emoji,
  value,
  label,
  tint,
  accessibilityLabel,
}: {
  emoji: string;
  value: string;
  label: string;
  tint: string;
  accessibilityLabel: string;
}) {
  const t = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}
    >
      <View style={{ width: 38, height: 38, borderRadius: t.radius.md, backgroundColor: tint + '22', alignItems: 'center', justifyContent: 'center' }}>
        {/* lineHeight ≥ fontSize so the emoji glyph isn't clipped at the top of the badge. */}
        <Text style={{ fontSize: 20, lineHeight: 26 }}>{emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontSize: t.fontSize.lg, fontWeight: '800', color: t.colors.foreground }}>{value}</Text>
        <Text variant="caption" numberOfLines={1}>{label}</Text>
      </View>
    </View>
  );
}

// Day math — same approach as (tabs)/challenges.tsx. Compare timestamps of local
// midnight; both values use the same tz offset so subtraction gives a tz-correct delta.
// Slight server / client drift on the day-boundary doesn't matter here — we only use it
// for "is the challenge currently active" and "did I submit today's day index".
function parseLocalMidnight(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
}
function localMidnightTs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
