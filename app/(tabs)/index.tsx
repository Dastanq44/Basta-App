import { useCallback, useMemo } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, Card, Icon, ProgressBar, Screen, StatTile, Text, useTheme } from '@/shared/ui';
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

  return (
    <Screen padded={false} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.lg, paddingBottom: t.spacing.xl }}>
        {/* Greeting — avatar is tappable, redirects to Profile. Avatar + text both
            bigger than before (46 → 64; heading variant → explicit larger size) so the
            greeting reads as the page header rather than an afterthought. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, flex: 1 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go to profile"
              onPress={() => router.push('/(tabs)/profile' as Href)}
              hitSlop={6}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              {avatarRemoteUrl ? (
                <Image
                  source={{ uri: avatarRemoteUrl }}
                  style={{ width: 64, height: 64, borderRadius: 32 }}
                />
              ) : (
                <Avatar name={name} size={64} />
              )}
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text variant="caption">Welcome back</Text>
              <Text
                numberOfLines={1}
                style={{
                  fontSize: t.fontSize.xl,
                  fontWeight: '700',
                  color: t.colors.foreground,
                  lineHeight: t.fontSize.xl * 1.2,
                  marginTop: 2,
                }}
              >
                Hi, {name} 👋
              </Text>
            </View>
          </View>
          {/* Bell icon — no longer wrapped in a circular card-bg button (the prior styles.iconBtn
              made a small white circle). Just the glyph with a tap dim. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            hitSlop={8}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.5 : 1,
            })}
          >
            <Icon name="bell" size={22} color={t.colors.foreground} />
          </Pressable>
        </View>

        {/* This week */}
        <Card>
          <Text variant="label">THIS WEEK</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: t.spacing.xs }}>
            <Text
              style={{
                fontSize: t.fontSize.xxxl,
                fontWeight: '800',
                color: t.colors.foreground,
                // Extra-bold digits at xxxl (40) need an explicit line box: without it
                // the ascender clips against the Card's top edge (the "0 / 7 …" looked
                // half-cut). Padded ~15% above the font size; `includeFontPadding: false`
                // also strips Android's default font-vertical padding.
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

        {/* Stat tiles */}
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <StatTile value={o?.currentStreak ?? 0} label="Day streak" tone="streak" icon="🔥" />
          <StatTile value={o ? `${o.todayDone}/${o.todayTotal}` : '0/0'} label="Today's tasks" tone="success" icon="✅" />
        </View>

        {/* Conditional: verify a friend */}
        {pending > 0 ? (
          <Pressable accessibilityRole="button" onPress={() => router.push('/verifications' as Href)}>
            <Card style={{ backgroundColor: t.colors.primary, borderColor: t.colors.primary }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Text variant="label" style={{ color: '#FFFFFF', opacity: 0.85 }}>
                    NEEDS YOU
                  </Text>
                  <Text style={{ color: '#FFFFFF', fontSize: t.fontSize.lg, fontWeight: '800', marginTop: 2 }}>
                    Verify a friend
                  </Text>
                  <Text style={{ color: '#FFFFFF', opacity: 0.9, marginTop: 2 }}>
                    {pending} proof{pending > 1 ? 's' : ''} waiting for your approval.
                  </Text>
                </View>
                <Icon name="chevron" size={20} color="#FFFFFF" />
              </View>
            </Card>
          </Pressable>
        ) : null}

        {/* Today — list of active challenges where today's proof is still missing.
            Same row format as the Challenges tab so the two surfaces match. Empty
            states differentiate "nothing pending" from "no challenges at all". */}
        <View style={{ gap: t.spacing.sm }}>
          <Text variant="heading">Today</Text>
          {challenges.isPending || recentSubmissions.isPending ? (
            <Card>
              <Text variant="muted">Loading…</Text>
            </Card>
          ) : openToday.length > 0 ? (
            <View style={{ gap: t.spacing.md }}>
              {openToday.map((c) => (
                <ChallengeRow key={c.id} challenge={c} />
              ))}
            </View>
          ) : (challenges.data?.length ?? 0) > 0 ? (
            <Card>
              <Text variant="subtitle">All done for today 🎉</Text>
              <Text variant="caption">Submit-the-day check: nothing left to log.</Text>
            </Card>
          ) : (
            <Card>
              <Text variant="subtitle">No active challenges</Text>
              <Text variant="caption">Start a challenge to begin building a streak.</Text>
              <Button label="New challenge" onPress={() => router.push('/challenge/new')} />
            </Card>
          )}
        </View>
      </ScrollView>
    </Screen>
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
