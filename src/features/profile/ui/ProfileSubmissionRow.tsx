import { Pressable, View } from 'react-native';
import { Card, Text, useTheme } from '@/shared/ui';
import { SyncBadge } from '@/features/proofs';
import type { Submission } from '@/entities';

const DATE_FMT: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };

export type ProfileSubmissionRowProps = {
  submission: Submission;
  onPress: () => void;
};

/** Compact submission row for the profile Submissions tab — title, date (+ group), day, sync badge,
 *  optional comment. Matches the app's existing profile list style (not the heavy GlobalFeedCard). */
export function ProfileSubmissionRow({ submission, onPress }: ProfileSubmissionRowProps) {
  const t = useTheme();
  const title = submission.title?.trim() || 'Untitled';
  const dateLabel = new Date(submission.createdAt).toLocaleDateString(undefined, DATE_FMT);
  const subline = submission.challengeGroupName ? `${dateLabel} · ${submission.challengeGroupName}` : dateLabel;
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: t.spacing.md }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="subtitle" numberOfLines={1}>{title}</Text>
            <Text variant="muted" numberOfLines={1}>{subline}</Text>
            {submission.comment ? (
              <Text variant="caption" numberOfLines={2}>{submission.comment}</Text>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Text variant="caption" style={{ color: t.colors.mutedForeground }}>
              Day {submission.challengeDay + 1}
            </Text>
            <SyncBadge status={submission.status} />
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
