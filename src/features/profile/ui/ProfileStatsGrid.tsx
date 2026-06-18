import { View } from 'react-native';
import { StatTile, useTheme } from '@/shared/ui';

export type ProfileStatsGridProps = {
  currentStreak: number;
  bestStreak: number;
  activeChallenges: number;
  groups: number;
};

/** 2×2 grid of compact stat cards: Current / Best streak, active Challenges, joined Groups. */
export function ProfileStatsGrid({ currentStreak, bestStreak, activeChallenges, groups }: ProfileStatsGridProps) {
  const t = useTheme();
  return (
    <View style={{ gap: t.spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
        <StatTile tone="streak" icon="🔥" value={currentStreak} unit={currentStreak === 1 ? 'day' : 'days'} label="Current" />
        <StatTile tone="primary" icon="🏆" value={bestStreak} unit={bestStreak === 1 ? 'day' : 'days'} label="Best" />
      </View>
      <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
        <StatTile tone="success" icon="🎯" value={activeChallenges} unit="active" label="Challenges" />
        <StatTile tone="warning" icon="👥" value={groups} unit="joined" label="Groups" />
      </View>
    </View>
  );
}
