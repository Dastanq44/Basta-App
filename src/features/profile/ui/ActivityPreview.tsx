import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { BottomSheet, Card, Text, useTheme } from '@/shared/ui';
import { useI18n } from '@/shared/i18n';
import type { Submission } from '@/entities';
import { ActivityHeatmap } from './ActivityHeatmap';

// Compact rolling activity preview: the last ~30 days as a fixed 7-col × 5-row grid (weekday-aligned,
// ending this week). Today is ringed; future days in the current week are inert. Tapping a day shows
// a date+count message (controlled by the parent so it clears on scroll). "View full activity" opens
// the full 90-day calendar in a bottom sheet.
const WEEKS = 5;
const DAYS = 7;
const GAP = 3;

export type ActivityDay = { key: string; date: Date; count: number };

export type ActivityPreviewProps = {
  submissions: Submission[];
  selected: ActivityDay | null;
  onSelect: (day: ActivityDay | null) => void;
};

type Cell = { date: Date; key: string; isFuture: boolean; isToday: boolean };

export function ActivityPreview({ submissions, selected, onSelect }: ActivityPreviewProps) {
  const t = useTheme();
  const { t: tr, tn, fmtDate } = useI18n();
  const [sheetOpen, setSheetOpen] = useState(false);

  const { weeks, counts } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startSunday = new Date(today);
    startSunday.setDate(today.getDate() - today.getDay() - (WEEKS - 1) * 7);

    const rows: Cell[][] = [];
    for (let w = 0; w < WEEKS; w++) {
      const week: Cell[] = [];
      for (let d = 0; d < DAYS; d++) {
        const date = new Date(startSunday);
        date.setDate(startSunday.getDate() + w * 7 + d);
        week.push({
          date,
          key: toYMD(date),
          isFuture: date.getTime() > today.getTime(),
          isToday: date.getTime() === today.getTime(),
        });
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
    count >= 2 ? t.colors.primary : count >= 1 ? t.colors.primarySoft : t.colors.muted;

  return (
    <View style={{ gap: t.spacing.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text variant="label" style={{ color: t.colors.mutedForeground }}>{tr('profile.activity').toUpperCase()}</Text>
        <Pressable accessibilityRole="button" onPress={() => setSheetOpen(true)} hitSlop={6}>
          <Text variant="caption" style={{ color: t.colors.primary }}>{tr('profile.viewFull')} →</Text>
        </Pressable>
      </View>

      <Card style={{ padding: t.spacing.sm, gap: GAP }}>
        {weeks.map((week, wi) => (
          <View key={wi} style={{ flexDirection: 'row', gap: GAP }}>
            {week.map((cell, di) => {
              if (cell.isFuture) {
                return <View key={di} style={{ flex: 1, aspectRatio: 1, borderRadius: 3, backgroundColor: t.colors.muted + '55' }} />;
              }
              const count = counts.get(cell.key) ?? 0;
              const isSel = selected?.key === cell.key;
              return (
                <Pressable
                  key={di}
                  style={{ flex: 1 }}
                  accessibilityRole="button"
                  accessibilityLabel={`${fmtDate(cell.date)}, ${tn('proofsCount', count)}`}
                  onPress={() => onSelect(isSel ? null : { key: cell.key, date: cell.date, count })}
                >
                  <View
                    style={{
                      flex: 1,
                      aspectRatio: 1,
                      borderRadius: 3,
                      backgroundColor: colorFor(count),
                      // Today gets a primary ring; a tapped cell a ring visible on any fill (never black).
                      borderWidth: cell.isToday || isSel ? 2 : 0,
                      borderColor: isSel ? (count >= 2 ? '#FFFFFF' : t.colors.primary) : cell.isToday ? t.colors.primary : 'transparent',
                    }}
                  />
                </Pressable>
              );
            })}
          </View>
        ))}
      </Card>

      {/* Date+count message — not tappable; parent clears `selected` on scroll. */}
      {selected ? (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: t.colors.primarySoft,
            borderRadius: t.radius.md,
            paddingVertical: t.spacing.sm,
            paddingHorizontal: t.spacing.md,
          }}
        >
          <Text variant="subtitle">
            {fmtDate(selected.date, { day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
          <Text variant="muted">{tn('proofsCount', selected.count)}</Text>
        </View>
      ) : null}

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <ActivityHeatmap submissions={submissions} />
      </BottomSheet>
    </View>
  );
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
