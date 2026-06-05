import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, Card, Icon, ProgressBar, Screen, StatTile, Text, useTheme } from '@/shared/ui';
import { useSession } from '@/features/auth';
import { homeOverviewQueryKey, pendingVerificationsQueryKey, useHomeOverview } from '@/features/home';

// Today / Home tab: weekly progress + streak + today's task + a conditional "Verify a friend"
// button (only when group proofs await the caller). All numbers are server-authoritative (D-003);
// no fake XP/levels (D-006) — stats map to real streak / submission / verification data.
export default function TodayScreen() {
  const t = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const session = useSession();
  const overview = useHomeOverview();

  // Recompute on focus so midnight rollover / a just-cleared verification reflect immediately.
  useFocusEffect(
    useCallback(() => {
      void qc.invalidateQueries({ queryKey: homeOverviewQueryKey });
      void qc.invalidateQueries({ queryKey: pendingVerificationsQueryKey });
    }, [qc]),
  );

  const email = session.session?.user.email ?? '';
  const name = (email ? email.split('@')[0] : '') || 'there';
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
            <Avatar name={name} size={46} />
            <View>
              <Text variant="caption">Welcome back</Text>
              <Text variant="heading">Hi, {name} 👋</Text>
            </View>
          </View>
          <View style={styles.iconBtn(t.colors.card, t.colors.border)}>
            <Icon name="bell" size={22} color={t.colors.foreground} />
          </View>
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

const styles = {
  iconBtn: (bg: string, border: string) => ({
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  }),
};
