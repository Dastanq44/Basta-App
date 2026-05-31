import { Pressable, View } from 'react-native';
import { Text, useTheme } from '@/shared/ui';
import { REACTION_EMOJIS } from '../model';
import { useReactToSubmission, useReactions } from '../hooks';

/** Row of emoji reaction chips — one selectable reaction per user, with live counts. */
export function ReactionBar({ submissionId }: { submissionId: string }) {
  const t = useTheme();
  const reactions = useReactions(submissionId);
  const react = useReactToSubmission(submissionId);
  const mine = reactions.data?.mine;
  const counts = reactions.data?.counts ?? {};

  return (
    <View style={{ flexDirection: 'row', gap: t.spacing.sm, flexWrap: 'wrap' }}>
      {REACTION_EMOJIS.map((emoji) => {
        const selected = mine === emoji;
        const count = counts[emoji] ?? 0;
        return (
          <Pressable
            key={emoji}
            accessibilityRole="button"
            accessibilityLabel={`React ${emoji}`}
            accessibilityState={{ selected }}
            disabled={react.isPending}
            hitSlop={6}
            onPress={() => react.mutate(selected ? null : emoji)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: t.spacing.md,
              paddingVertical: 8,
              borderRadius: t.radius.full,
              backgroundColor: selected ? t.colors.accent : t.colors.muted,
              borderWidth: selected ? 0 : 1,
              borderColor: t.colors.border,
              opacity: react.isPending ? 0.6 : 1,
            }}
          >
            <Text style={{ fontSize: t.fontSize.md }}>{emoji}</Text>
            {count > 0 ? (
              <Text
                style={{
                  fontSize: t.fontSize.sm,
                  fontWeight: '600',
                  color: selected ? t.colors.accentForeground : t.colors.mutedForeground,
                }}
              >
                {count}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
