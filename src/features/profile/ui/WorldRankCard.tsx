import { View } from 'react-native';
import { Card, Text, useTheme } from '@/shared/ui';

/**
 * Small World Rank card. A real global ranking system is out of scope — the app has only ever had a
 * placeholder, so this stays an honest "coming soon" card (no fabricated rank/percentile numbers).
 * When real rank data exists, render `#N` + `Top X%` here instead.
 */
export function WorldRankCard() {
  const t = useTheme();
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ flex: 1 }}>
        <Text variant="label" style={{ color: t.colors.mutedForeground }}>WORLD RANK</Text>
        <Text variant="heading">Coming soon</Text>
      </View>
      <Text style={{ fontSize: 26 }}>🌍</Text>
    </Card>
  );
}
