import { Pressable, View } from 'react-native';
import { Card, Text, useTheme } from '@/shared/ui';
import type { ProfileChallenge } from '../api';
import { Pill, type PillTone } from './Pill';

export type ProfileChallengeCardProps = {
  challenge: ProfileChallenge;
  /** Provided only when the viewer can open the challenge (participant). */
  onPress?: () => void;
  isOwn: boolean;
};

type Status = { label: string; tone: PillTone; day: number };

function computeStatus(startDate: string, durationDays: number): Status {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(start);
  end.setDate(start.getDate() + durationDays - 1);
  if (today.getTime() < start.getTime()) return { label: 'Upcoming', tone: 'muted', day: 0 };
  if (today.getTime() > end.getTime()) return { label: 'Completed', tone: 'success', day: durationDays };
  const day = Math.floor((today.getTime() - start.getTime()) / 86_400_000) + 1;
  return { label: 'Active', tone: 'primary', day };
}

/** Challenge card for the profile Challenges tab. Always tappable — the challenge route decides
 *  full member detail vs read-only public preview. */
export function ProfileChallengeCard({ challenge, onPress, isOwn }: ProfileChallengeCardProps) {
  const t = useTheme();
  const st = computeStatus(challenge.startDate, challenge.durationDays);
  const progress =
    st.label === 'Completed' || st.label === 'Upcoming'
      ? `${challenge.durationDays} days`
      : `Day ${Math.min(st.day, challenge.durationDays)} of ${challenge.durationDays}`;
  // On another user's profile, flag challenges you'd open as a read-only preview.
  const showPublicPreview = !isOwn && !challenge.isParticipant;

  const body = (
    <Card style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
        <Text variant="subtitle" numberOfLines={1} style={{ flex: 1 }}>{challenge.title}</Text>
        {isOwn && !challenge.isPublic ? <Pill label="Hidden" tone="muted" /> : null}
        {showPublicPreview ? <Pill label="Public preview" tone="muted" /> : null}
        <Text variant="muted">›</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, flexWrap: 'wrap' }}>
        <Pill label={st.label} tone={st.tone} />
        <Text variant="caption" style={{ color: t.colors.mutedForeground }}>{progress}</Text>
        {challenge.groupName ? (
          <Text variant="caption" style={{ color: t.colors.mutedForeground }} numberOfLines={1}>
            · {challenge.groupName}
          </Text>
        ) : null}
      </View>
    </Card>
  );

  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress}>{body}</Pressable>
  ) : (
    body
  );
}
