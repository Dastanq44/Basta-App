import { Pressable, View } from 'react-native';
import { Link } from 'expo-router';
import { Card, Icon, ProgressBar, Text, useTheme } from '@/shared/ui';
import { formatChallengeCategory, useI18n } from '@/shared/i18n';
import type { Challenge } from '@/entities';

export type ChallengeRowProps = {
  challenge: Challenge;
};

/**
 * The standard "open a challenge" row card. Shared between the Challenges tab list and the Home
 * tab's "Today" section so both surfaces stay visually identical — taps navigate to
 * `challenge/[id]`. Now progress-led: a category chip + a Day X / N indicator with a bar so the
 * row communicates where the challenge stands at a glance.
 */
export function ChallengeRow({ challenge }: ChallengeRowProps) {
  const t = useTheme();
  const { t: tr, lang } = useI18n();

  const startTs = parseLocalMidnight(challenge.startDate);
  const todayDay = startTs == null ? null : Math.round((localMidnightTs(new Date()) - startTs) / 86_400_000);
  const total = Math.max(1, challenge.durationDays);
  const upcoming = todayDay != null && todayDay < 0;
  const finished = todayDay != null && todayDay >= total;
  const clampedDay = todayDay == null ? 0 : Math.min(total - 1, Math.max(0, todayDay));
  const progress = finished ? 1 : todayDay == null ? 0 : Math.min(1, Math.max(0, (clampedDay + 1) / total));
  const dayLabel = upcoming
    ? '—'
    : finished
      ? tr('challenges.finished')
      : tr('challenges.dayOf', { current: clampedDay + 1, total });
  const statusColor = finished ? t.colors.success : upcoming ? t.colors.mutedForeground : t.colors.primary;

  return (
    <Link href={{ pathname: '/challenge/[id]', params: { id: challenge.id } }} asChild>
      <Pressable accessibilityRole="button" accessibilityLabel={challenge.title}>
        <Card style={{ gap: t.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: t.radius.md,
                backgroundColor: statusColor + '22',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="tasks" size={22} color={statusColor} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="subtitle" numberOfLines={1}>
                {challenge.title}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
                <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: t.radius.full, backgroundColor: t.colors.primarySoft }}>
                  <Text style={{ fontSize: t.fontSize.xs, fontWeight: '700', color: t.colors.primary }} numberOfLines={1}>
                    {formatChallengeCategory(lang, challenge.category)}
                  </Text>
                </View>
                <Text variant="caption" numberOfLines={1}>
                  {challenge.mode === 'group' ? tr('mode.group') : tr('mode.solo')}
                </Text>
              </View>
            </View>
            <Icon name="chevron" size={18} color={t.colors.mutedForeground} />
          </View>
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="label" style={{ color: statusColor }}>{dayLabel}</Text>
              <Text variant="label" style={{ color: t.colors.mutedForeground }}>{Math.round(progress * 100)}%</Text>
            </View>
            <ProgressBar value={progress} height={6} />
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}

// Day math — compare local-midnight timestamps (same tz offset cancels out). Display-only, so
// slight client/server day-boundary drift is acceptable (matches Today + Challenges screens).
function parseLocalMidnight(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
}
function localMidnightTs(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
