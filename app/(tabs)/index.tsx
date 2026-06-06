import { useCallback, useMemo } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, Card, Icon, ProgressBar, Screen, StatTile, Text, useTheme } from '@/shared/ui';
import { useSession } from '@/features/auth';
import { homeOverviewQueryKey, pendingVerificationsQueryKey, useHomeOverview } from '@/features/home';
import { useProfile, userAvatarUrl } from '@/features/onboarding';

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
  const todayLeft = o ? Math.max(0, o.todayTotal - o.todayDone) : 0;

  return (
    <Screen padded={false} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.lg, paddingBottom: t.spacing.xl }}>
        {/* Greeting */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
            {avatarRemoteUrl ? (
              <Image source={{ uri: avatarRemoteUrl }} style={{ width: 46, height: 46, borderRadius: 23 }} />
            ) : (
              <Avatar name={name} size={46} />
            )}
            <View>
              <Text variant="caption">Welcome back</Text>
              <Text variant="heading">Hi, {name} 👋</Text>
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

        {/* Today's task */}
        <View style={{ gap: t.spacing.sm }}>
          <Text variant="heading">Today</Text>
          <Card>
            {overview.isPending ? (
              <Text variant="muted">Loading…</Text>
            ) : todayLeft > 0 ? (
              <View style={{ gap: t.spacing.sm }}>
                <Text variant="subtitle">
                  {todayLeft} task{todayLeft > 1 ? 's' : ''} left today
                </Text>
                <Text variant="caption">Submit today&apos;s proof to keep your streak alive.</Text>
                <Button label="Go to challenges" onPress={() => router.navigate('/challenges' as Href)} />
              </View>
            ) : (o?.todayTotal ?? 0) > 0 ? (
              <Text variant="subtitle">All done for today 🎉</Text>
            ) : (
              <View style={{ gap: t.spacing.sm }}>
                <Text variant="subtitle">No active challenges</Text>
                <Text variant="caption">Start a challenge to begin building a streak.</Text>
                <Button label="New challenge" onPress={() => router.push('/challenge/new')} />
              </View>
            )}
          </Card>
        </View>
      </ScrollView>
    </Screen>
  );
}

