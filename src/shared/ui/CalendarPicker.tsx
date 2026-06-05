import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './Text';
import { useTheme } from './theme';

export type CalendarPickerProps = {
  /** Selected day as ISO YYYY-MM-DD. */
  value: string;
  /** Day-tap handler. Always returns ISO YYYY-MM-DD in local time. */
  onChange: (iso: string) => void;
  /** Earliest selectable day (ISO). Days before this are dimmed and unresponsive. */
  minDate?: string;
  /** Latest selectable day (ISO). Days after this are dimmed and unresponsive. */
  maxDate?: string;
};

/**
 * Dependency-free month-grid date picker. Header has prev/next month arrows + month
 * label; a 7-column grid below with weekday letters and 6 rows of tappable day cells.
 * Visually inspired by HorizonCalendar (Airbnb) — clean numbers, prominent selected
 * day, dim out-of-month padding.
 *
 * State note: only the *displayed month* is local. The selected day flows through
 * `value` / `onChange`, so the parent owns the canonical date and the picker is
 * a controlled component.
 */
export function CalendarPicker({ value, onChange, minDate, maxDate }: CalendarPickerProps) {
  const t = useTheme();
  const selected = parseISO(value) ?? today();
  // Track which month we're showing. Initialize from the selected day so reopening the
  // picker on a far-future date doesn't dump the user on the current month.
  const [view, setView] = useState<{ y: number; m: number }>({ y: selected.y, m: selected.m });

  const grid = useMemo(() => buildGrid(view.y, view.m), [view.y, view.m]);
  const min = minDate ? parseISO(minDate) : null;
  const max = maxDate ? parseISO(maxDate) : null;
  const todayD = today();

  return (
    <View
      style={{
        backgroundColor: t.colors.card,
        borderRadius: t.radius.lg,
        borderWidth: 1,
        borderColor: t.colors.border,
        padding: t.spacing.md,
        gap: t.spacing.sm,
      }}
    >
      {/* Header: ‹  Month YYYY  › */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <ArrowButton direction="left" onPress={() => setView(addMonths(view, -1))} color={t.colors.foreground} />
        <Text variant="subtitle" style={{ color: t.colors.foreground, fontWeight: '600' }}>
          {monthLabel(view.y, view.m)}
        </Text>
        <ArrowButton direction="right" onPress={() => setView(addMonths(view, 1))} color={t.colors.foreground} />
      </View>

      {/* Weekday header row */}
      <View style={{ flexDirection: 'row' }}>
        {WEEKDAYS.map((d) => (
          <View key={d} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
            <Text variant="caption" style={{ color: t.colors.mutedForeground, fontWeight: '600' }}>
              {d}
            </Text>
          </View>
        ))}
      </View>

      {/* 6 × 7 day grid */}
      <View>
        {grid.map((row, ri) => (
          <View key={ri} style={{ flexDirection: 'row' }}>
            {row.map((cell, ci) => {
              const iso = formatISO(cell.y, cell.m, cell.d);
              const isSelected = sameDay(cell, selected);
              const isToday = sameDay(cell, todayD);
              const inMonth = cell.m === view.m;
              const blocked =
                (min && beforeDay(cell, min)) || (max && beforeDay(max, cell));
              return (
                <DayCell
                  key={`${ri}-${ci}`}
                  label={String(cell.d)}
                  selected={isSelected}
                  isToday={isToday}
                  dimmed={!inMonth}
                  disabled={!!blocked}
                  onPress={() => {
                    if (blocked) return;
                    // Selecting an out-of-month day also jumps the view to that month
                    // so the next render shows the day in context (mirrors HorizonCalendar).
                    if (!inMonth) setView({ y: cell.y, m: cell.m });
                    onChange(iso);
                  }}
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ────────────────────────────────────────────────────────────────────────────

function ArrowButton({
  direction,
  onPress,
  color,
}: {
  direction: 'left' | 'right';
  onPress: () => void;
  color: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={direction === 'left' ? 'Previous month' : 'Next month'}
      onPress={onPress}
      hitSlop={8}
      style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
    >
      {/* Chevron via the standard border-rotate trick. */}
      <View
        style={{
          width: 10,
          height: 10,
          borderTopWidth: 2,
          borderRightWidth: 2,
          borderColor: color,
          transform: [{ rotate: direction === 'left' ? '-135deg' : '45deg' }],
        }}
      />
    </Pressable>
  );
}

function DayCell({
  label,
  selected,
  isToday,
  dimmed,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  isToday: boolean;
  dimmed: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const textColor = selected
    ? t.colors.primaryForeground
    : disabled
      ? t.colors.mutedForeground
      : dimmed
        ? t.colors.mutedForeground
        : t.colors.foreground;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={{ flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 2 }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: selected ? t.colors.primary : 'transparent',
          borderWidth: !selected && isToday ? 1.5 : 0,
          borderColor: t.colors.primary,
          opacity: disabled ? 0.4 : dimmed ? 0.45 : 1,
        }}
      >
        <Text style={{ color: textColor, fontWeight: selected ? '700' : '500' }}>{label}</Text>
      </View>
    </Pressable>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Date math (zero-dep — avoids tz pitfalls by working in local-day components).
// ────────────────────────────────────────────────────────────────────────────

type Day = { y: number; m: number; d: number };
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatISO(y: number, m: number, d: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function parseISO(iso: string): Day | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]) - 1;
  const d = Number(match[3]);
  if (m < 0 || m > 11 || d < 1 || d > 31) return null;
  return { y, m, d };
}

function today(): Day {
  const now = new Date();
  return { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
}

function sameDay(a: Day, b: Day): boolean {
  return a.y === b.y && a.m === b.m && a.d === b.d;
}

/** True if `a` is strictly before `b` (day-precision). */
function beforeDay(a: Day, b: Day): boolean {
  if (a.y !== b.y) return a.y < b.y;
  if (a.m !== b.m) return a.m < b.m;
  return a.d < b.d;
}

function addMonths(view: { y: number; m: number }, delta: number): { y: number; m: number } {
  const total = view.y * 12 + view.m + delta;
  return { y: Math.floor(total / 12), m: ((total % 12) + 12) % 12 };
}

function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}

function monthLabel(y: number, m: number): string {
  return `${MONTHS[m]} ${y}`;
}

/** 6 × 7 grid of Day cells starting on Sunday and padded from neighbouring months. */
function buildGrid(y: number, m: number): Day[][] {
  const firstDow = new Date(y, m, 1).getDay(); // 0..6 Sun..Sat
  const dim = daysInMonth(y, m);
  const prev = addMonths({ y, m }, -1);
  const prevDim = daysInMonth(prev.y, prev.m);

  const cells: Day[] = [];
  // Prefix from previous month.
  for (let i = firstDow - 1; i >= 0; i--) {
    cells.push({ y: prev.y, m: prev.m, d: prevDim - i });
  }
  // Current month.
  for (let d = 1; d <= dim; d++) {
    cells.push({ y, m, d });
  }
  // Suffix from next month to fill 6 weeks.
  const next = addMonths({ y, m }, 1);
  let nd = 1;
  while (cells.length < 42) {
    cells.push({ y: next.y, m: next.m, d: nd++ });
  }

  const rows: Day[][] = [];
  for (let r = 0; r < 6; r++) {
    rows.push(cells.slice(r * 7, r * 7 + 7));
  }
  return rows;
}
