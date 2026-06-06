import { Pressable, View } from 'react-native';
import { Link } from 'expo-router';
import { Card, Icon, Text, useTheme } from '@/shared/ui';
import type { Challenge } from '@/entities';

export type ChallengeRowProps = {
  challenge: Challenge;
};

/**
 * The standard "open a challenge" row card. Shared between the Challenges tab list and
 * the Home tab's "Today" section so both surfaces stay visually identical — taps
 * navigate to `challenge/[id]`.
 */
export function ChallengeRow({ challenge }: ChallengeRowProps) {
  const t = useTheme();
  return (
    <Link href={{ pathname: '/challenge/[id]', params: { id: challenge.id } }} asChild>
      <Pressable accessibilityRole="button">
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: t.colors.primarySoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="tasks" size={22} color={t.colors.primary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="subtitle" numberOfLines={1}>
                {challenge.title}
              </Text>
              <Text variant="caption">
                {challenge.category} · {challenge.mode} · {challenge.durationDays} days
              </Text>
            </View>
            <Icon name="chevron" size={18} color={t.colors.mutedForeground} />
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}
