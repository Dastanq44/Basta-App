import { useMemo, useState } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import { BottomSheet, Card, Text, useTheme } from '@/shared/ui';
import type { Submission } from '@/entities';
import { ActivityHeatmap } from './ActivityHeatmap';

// Compact current-month activity. Days are laid out SEQUENTIALLY (day 1 top-left, 7 per row — not
// weekday-aligned). Future days are non-clickable, light, and hatched. An arrow after the last day
// shows direction. Tapping a day shows a date+count message (controlled by the parent so it can be
// dismissed on scroll / other actions; the message itself isn't tappable).
const COLS = 7;
const GAP = 3;

export type ActivityDay = { key: string; date: Date; count: number };

export type ActivityPreviewProps = {
  submissions: Submission[];
  selected: ActivityDay | null;
  onSelect: (day: ActivityDay | null) => void;
};

type Cell =
  | { kind: 'day'; date: Date; key: string; count: number; isFuture: boolean }
  | { kind: 'arrow' }
  | null;

export function ActivityPreview({ submissions, selected, onSelect }: ActivityPreviewProps) {
  const t = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);

  const { rows, monthLabel } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const year = today.getFullYear();
    const month = today.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const counts = new Map<string, number>();
    for (const s of submissions) {
      const k = toYMD(new Date(s.createdAt));
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }

    const cells: Cell[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const key = toYMD(date);
      cells.push({ kind: 'day', date, key, count: counts.get(key) ?? 0, isFuture: date.getTime() > today.getTime() });
    }
    cells.push({ kind: 'arrow' }); // direction indicator after the last day
    while (cells.length % COLS !== 0) cells.push(null);

    const grid: Cell[][] = [];
    for (let i = 0; i < cells.length; i += COLS) grid.push(cells.slice(i, i + COLS));
    return { rows: grid, monthLabel: today.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) };
  }, [submissions]);

  const colorFor = (count: number) =>
    count >= 2 ? t.colors.primary : count >= 1 ? t.colors.primarySoft : t.colors.muted;

  return (
    <View style={{ gap: t.spacing.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text variant="label" style={{ color: t.colors.mutedForeground }}>
          ACTIVITY · {monthLabel.toUpperCase()}
        </Text>
        <Pressable accessibilityRole="button" onPress={() => setSheetOpen(true)} hitSlop={6}>
          <Text variant="caption" style={{ color: t.colors.primary }}>View full activity →</Text>
        </Pressable>
      </View>

      <Card style={{ padding: t.spacing.sm, gap: GAP }}>
        {rows.map((row, ri) => (
          <View key={ri} style={{ flexDirection: 'row', gap: GAP }}>
            {row.map((cell, ci) => {
              if (!cell) return <View key={ci} style={{ flex: 1, aspectRatio: 1 }} />;

              if (cell.kind === 'arrow') {
                return (
                  <View key={ci} style={{ flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: t.colors.mutedForeground, fontSize: 15, fontWeight: '800' }}>→</Text>
                  </View>
                );
              }

              if (cell.isFuture) {
                // Inaccessible future day: light fill + diagonal hatch, not pressable.
                return (
                  <View
                    key={ci}
                    style={{ flex: 1, aspectRatio: 1, borderRadius: 3, backgroundColor: t.colors.muted + '55', overflow: 'hidden' }}
                  >
                    <View style={HATCH(t.colors.border, '34%')} />
                    <View style={HATCH(t.colors.border, '64%')} />
                  </View>
                );
              }

              const isSel = selected?.key === cell.key;
              return (
                <Pressable
                  key={ci}
                  style={{ flex: 1 }}
                  accessibilityRole="button"
                  accessibilityLabel={`${cell.date.toLocaleDateString()}, ${cell.count} submission${cell.count === 1 ? '' : 's'}`}
                  onPress={() => onSelect(isSel ? null : { key: cell.key, date: cell.date, count: cell.count })}
                >
                  <View
                    style={{
                      flex: 1,
                      aspectRatio: 1,
                      borderRadius: 3,
                      backgroundColor: colorFor(cell.count),
                      // Visible on ANY fill, never black: white ring on indigo cells, indigo ring otherwise.
                      borderWidth: isSel ? 2.5 : 0,
                      borderColor: isSel ? (cell.count >= 2 ? '#FFFFFF' : t.colors.primary) : 'transparent',
                    }}
                  />
                </Pressable>
              );
            })}
          </View>
        ))}
      </Card>

      {/* Date+count message — NOT tappable (so it doesn't dismiss on its own tap). The parent clears
          `selected` on scroll / other actions. */}
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
            {selected.date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
          </Text>
          <Text variant="muted">
            {selected.count} submission{selected.count === 1 ? '' : 's'}
          </Text>
        </View>
      ) : null}

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <ActivityHeatmap submissions={submissions} />
      </BottomSheet>
    </View>
  );
}

/** A single diagonal hatch line (for "disabled" future cells). `top` positions it within the cell. */
function HATCH(color: string, top: ViewStyle['top']): ViewStyle {
  return {
    position: 'absolute',
    width: '170%',
    height: 1,
    left: '-35%',
    top,
    backgroundColor: color,
    transform: [{ rotate: '45deg' }],
  };
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
