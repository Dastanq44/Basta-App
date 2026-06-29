import { Pressable, View } from 'react-native';
import { Card, Icon, ProgressBar, Text, useTheme } from '@/shared/ui';
import { formatDays, useI18n, type I18nKey } from '@/shared/i18n';
import type { ProfileChallenge } from '../api';
import { Pill, type PillTone } from './Pill';

export type ProfileChallengeCardProps = {
  challenge: ProfileChallenge;
  /** Provided only when the viewer can open the challenge (participant). */
  onPress?: () => void;
  isOwn: boolean;
};

type StatusKind = 'upcoming' | 'active' | 'completed';
type Status = { kind: StatusKind; labelKey: I18nKey; tone: PillTone; day: number };

function computeStatus(startDate: string, durationDays: number): Status {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(start);
  end.setDate(start.getDate() + durationDays - 1);
  if (today.getTime() < start.getTime()) return { kind: 'upcoming', labelKey: 'cstate.upcoming', tone: 'muted', day: 0 };
  if (today.getTime() > end.getTime()) return { kind: 'completed', labelKey: 'cstate.completed', tone: 'success', day: durationDays };
  const day = Math.floor((today.getTime() - start.getTime()) / 86_400_000) + 1;
  return { kind: 'active', labelKey: 'cstate.active', tone: 'primary', day };
}

/** Challenge card for the profile Challenges tab. Always tappable — the challenge route decides
 *  full member detail vs read-only public preview. */
export function ProfileChallengeCard({ challenge, onPress, isOwn }: ProfileChallengeCardProps) {
  const t = useTheme();
  const { t: tr, lang } = useI18n();
  const st = computeStatus(challenge.startDate, challenge.durationDays);
  const progress =
    st.kind === 'completed' || st.kind === 'upcoming'
      ? formatDays(lang, challenge.durationDays)
      : tr('challenges.dayOf', { current: Math.min(st.day, challenge.durationDays), total: challenge.durationDays });
  const progressFraction =
    st.kind === 'completed' ? 1 : st.kind === 'upcoming' ? 0 : Math.min(1, st.day / Math.max(1, challenge.durationDays));
  const barColor = st.tone === 'success' ? t.colors.success : t.colors.primary;

  const body = (
    <Card style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
        <Text variant="subtitle" numberOfLines={1} style={{ flex: 1 }}>{challenge.title}</Text>
        {isOwn && !challenge.isPublic ? <Pill label={tr('pill.hidden')} tone="muted" /> : null}
        <Icon name="chevron" size={16} color={t.colors.mutedForeground} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, flexWrap: 'wrap' }}>
        <Pill label={tr(st.labelKey)} tone={st.tone} />
        <Text variant="caption" style={{ color: t.colors.mutedForeground }}>{progress}</Text>
        {challenge.groupName ? (
          <Text variant="caption" style={{ color: t.colors.mutedForeground }} numberOfLines={1}>
            · {challenge.groupName}
          </Text>
        ) : null}
      </View>
      {st.kind !== 'upcoming' ? <ProgressBar value={progressFraction} height={5} color={barColor} /> : null}
    </Card>
  );

  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress}>{body}</Pressable>
  ) : (
    body
  );
}
