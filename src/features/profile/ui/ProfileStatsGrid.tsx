import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from '@/shared/ui';
import { useI18n } from '@/shared/i18n';

export type ProfileStatsGridProps = {
  currentStreak: number;
  bestStreak: number;
  activeChallenges: number;
  groups: number;
};

type Tone = 'streak' | 'primary' | 'success' | 'warning';

/** 2×2 grid of profile stats. Each card shows an emoji + a bold, prominent LABEL on the top row,
 *  with the counter value sized to match below it. */
export function ProfileStatsGrid({ currentStreak, bestStreak, activeChallenges, groups }: ProfileStatsGridProps) {
  const t = useTheme();
  const { t: tr, tn } = useI18n();
  return (
    <View style={{ gap: t.spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
        <ProfileStatCard tone="streak" icon="🔥" label={tr('challenge.currentStreak')} value={currentStreak} unit={tn('unit.day', currentStreak)} />
        <ProfileStatCard tone="primary" icon="🏆" label={tr('challenge.bestStreak')} value={bestStreak} unit={tn('unit.day', bestStreak)} />
      </View>
      <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
        <ProfileStatCard tone="success" icon="🎯" label={tr('common.challenges')} value={activeChallenges} unit={tr('stats.active')} />
        <ProfileStatCard tone="warning" icon="👥" label={tr('common.groups')} value={groups} unit={tr('stats.joined')} />
      </View>
    </View>
  );
}

function ProfileStatCard({
  icon,
  label,
  value,
  unit,
  tone,
}: {
  icon: ReactNode | string;
  label: string;
  value: number;
  unit?: string;
  tone: Tone;
}) {
  const t = useTheme();
  const toneColor = { streak: t.colors.streak, success: t.colors.success, warning: t.colors.warning, primary: t.colors.primary }[tone];
  return (
    <View style={[styles.card, { backgroundColor: t.colors.card, borderColor: t.colors.border, borderRadius: t.radius.lg }, t.shadow.sm]}>
      {/* Top row: emoji + bold label to its right. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: toneColor + '22', alignItems: 'center', justifyContent: 'center' }}>
          {typeof icon === 'string' ? <Text style={{ fontSize: 17 }}>{icon}</Text> : icon}
        </View>
        <Text style={{ flex: 1, fontWeight: '500', fontSize: t.fontSize.sm, color: t.colors.foreground }} numberOfLines={1}>
          {label}
        </Text>
      </View>
      {/* Counter, sized to relate to the label above. */}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 10 }}>
        <Text style={{ fontWeight: '800', fontSize: t.fontSize.xl, color: t.colors.foreground }}>{value}</Text>
        {unit ? (
          <Text style={{ fontSize: t.fontSize.sm, fontWeight: '700', color: t.colors.mutedForeground, marginLeft: 4 }}>{unit}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, padding: 14, borderWidth: StyleSheet.hairlineWidth },
});
