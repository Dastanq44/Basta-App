import { useMemo, useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { Text, useTheme } from '@/shared/ui';
import type { Submission } from '@/entities';

// GitHub-style daily activity calendar, last 90 days.
//
// Grid: 13 columns (weeks) × 7 rows (days, Sun..Sat). Newest week on the right.
// Each cell is colored by the count of submissions on that local-date — verified,
// pending, and rejected all count toward the heat (the user picked the inclusive
// variant so still-pending days visually register).
const HEATMAP_WEEKS = 13;
const HEATMAP_DAYS = 7;
const HEATMAP_GAP = 3;

export function ActivityHeatmap({ submissions }: { submissions: Submission[] }) {
  const t = useTheme();
  const { width: winW } = useWindowDimensions();
  const [selected, setSelected] = useState<{ date: Date; count: number; key: string } | null>(null);

  const cellSize = Math.max(
    12,
    Math.floor(
      (winW - 2 * t.spacing.lg - 2 * t.spacing.sm - (HEATMAP_WEEKS - 1) * HEATMAP_GAP) /
        HEATMAP_WEEKS,
    ),
  );

  const { cells, counts } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startSunday = new Date(today);
    startSunday.setDate(today.getDate() - today.getDay() - (HEATMAP_WEEKS - 1) * 7);

    const cellArr: { date: Date; key: string; inRange: boolean }[] = [];
    for (let w = 0; w < HEATMAP_WEEKS; w++) {
      for (let d = 0; d < HEATMAP_DAYS; d++) {
        const date = new Date(startSunday);
        date.setDate(startSunday.getDate() + w * 7 + d);
        const key = toLocalYMD(date);
        cellArr.push({ date, key, inRange: date.getTime() <= today.getTime() });
      }
    }

    const countMap = new Map<string, number>();
    for (const s of submissions) {
      const key = toLocalYMD(new Date(s.createdAt));
      countMap.set(key, (countMap.get(key) ?? 0) + 1);
    }
    return { cells: cellArr, counts: countMap };
  }, [submissions]);

  const colorFor = (count: number, _inRange: boolean): string => {
    if (count >= 4) return t.colors.primary;
    if (count >= 2) return blendPrimary(t.colors.primarySoft, t.colors.primary, 0.65);
    if (count >= 1) return t.colors.primarySoft;
    return t.colors.border;
  };

  return (
    <View style={{ gap: t.spacing.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text variant="label" style={{ color: t.colors.mutedForeground }}>
          ACTIVITY · LAST 90 DAYS
        </Text>
        <Text variant="caption" style={{ color: t.colors.mutedForeground }}>
          {submissions.length} submissions
        </Text>
      </View>

      <View
        style={{
          padding: t.spacing.sm,
          backgroundColor: t.colors.card,
          borderRadius: t.radius.md,
          borderWidth: 1,
          borderColor: t.colors.border,
          gap: t.spacing.xs,
        }}
      >
        <View style={{ flexDirection: 'row', gap: HEATMAP_GAP, justifyContent: 'space-between' }}>
          {Array.from({ length: HEATMAP_WEEKS }, (_, col) => (
            <View key={col} style={{ gap: HEATMAP_GAP }}>
              {Array.from({ length: HEATMAP_DAYS }, (_, row) => {
                const cell = cells[col * HEATMAP_DAYS + row];
                if (!cell) return null;
                const count = counts.get(cell.key) ?? 0;
                const isSelected = selected?.key === cell.key;
                return (
                  <Pressable
                    key={row}
                    accessibilityRole="button"
                    accessibilityLabel={`${cell.date.toLocaleDateString()}, ${count} submission${count === 1 ? '' : 's'}`}
                    onPress={() =>
                      setSelected((prev) => (prev?.key === cell.key ? null : { date: cell.date, count, key: cell.key }))
                    }
                  >
                    <View
                      style={{
                        width: cellSize,
                        height: cellSize,
                        borderRadius: 3,
                        backgroundColor: colorFor(count, cell.inRange),
                        borderWidth: isSelected ? 1.5 : 0,
                        borderColor: t.colors.primary,
                      }}
                    />
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {selected ? (
          <View
            style={{
              marginTop: t.spacing.xs,
              paddingTop: t.spacing.xs,
              borderTopWidth: 1,
              borderTopColor: t.colors.border,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text variant="subtitle">
              {selected.date.toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </Text>
            <Text variant="muted">
              {selected.count} submission{selected.count === 1 ? '' : 's'}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function toLocalYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function blendPrimary(aHex: string, bHex: string, ratio: number): string {
  const a = parseHex(aHex);
  const b = parseHex(bHex);
  if (!a || !b) return aHex;
  const r = Math.round(a.r + (b.r - a.r) * ratio);
  const g = Math.round(a.g + (b.g - a.g) * ratio);
  const bb = Math.round(a.b + (b.b - a.b) * ratio);
  return `#${[r, g, bb].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const v = parseInt(m[1]!, 16);
  return { r: (v >> 16) & 0xff, g: (v >> 8) & 0xff, b: v & 0xff };
}
