import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { Card, Text, useTheme } from '@/shared/ui';
import type { Submission } from '@/entities';

// Compact 30-day activity preview: a 7-column × 5-row mini grid (days × weeks), much smaller than
// the full 90-day calendar, so content sits higher on the profile. Tapping opens the full view.
const WEEKS = 5;
const DAYS = 7;
const GAP = 3;

export type ActivityPreviewProps = {
  submissions: Submission[];
  onViewFull: () => void;
};

export function ActivityPreview({ submissions, onViewFull }: ActivityPreviewProps) {
  const t = useTheme();

  const { weeks, counts } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startSunday = new Date(today);
    startSunday.setDate(today.getDate() - today.getDay() - (WEEKS - 1) * 7);

    const rows: { key: string; inRange: boolean }[][] = [];
    for (let w = 0; w < WEEKS; w++) {
      const week: { key: string; inRange: boolean }[] = [];
      for (let d = 0; d < DAYS; d++) {
        const date = new Date(startSunday);
        date.setDate(startSunday.getDate() + w * 7 + d);
        week.push({ key: toYMD(date), inRange: date.getTime() <= today.getTime() });
      }
      rows.push(week);
    }
    const m = new Map<string, number>();
    for (const s of submissions) {
      const k = toYMD(new Date(s.createdAt));
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return { weeks: rows, counts: m };
  }, [submissions]);

  const colorFor = (count: number) =>
    count >= 2 ? t.colors.primary : count >= 1 ? t.colors.primarySoft : t.colors.border;

  return (
    <View style={{ gap: t.spacing.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text variant="label" style={{ color: t.colors.mutedForeground }}>
          ACTIVITY · LAST 30 DAYS
        </Text>
        <Pressable accessibilityRole="button" onPress={onViewFull} hitSlop={6}>
          <Text variant="caption" style={{ color: t.colors.primary }}>
            View full activity →
          </Text>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="View full activity" onPress={onViewFull}>
        <Card style={{ padding: t.spacing.sm, gap: GAP }}>
          {weeks.map((week, wi) => (
            <View key={wi} style={{ flexDirection: 'row', gap: GAP }}>
              {week.map((cell, di) => (
                <View
                  key={di}
                  style={{
                    flex: 1,
                    aspectRatio: 1,
                    borderRadius: 3,
                    backgroundColor: cell.inRange ? colorFor(counts.get(cell.key) ?? 0) : 'transparent',
                  }}
                />
              ))}
            </View>
          ))}
        </Card>
      </Pressable>
    </View>
  );
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
