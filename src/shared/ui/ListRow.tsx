import type { ReactNode } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { useTheme } from './theme';

export type ListRowProps = {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  /** Tints the row (e.g. the "you" row in a leaderboard). */
  highlighted?: boolean;
};

/** Generic list row: leading slot + title/subtitle + trailing slot. Pressable when onPress is set. */
export function ListRow({ title, subtitle, leading, trailing, onPress, highlighted = false }: ListRowProps) {
  const t = useTheme();
  const base: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingVertical: t.spacing.sm + 2,
    paddingHorizontal: t.spacing.md,
    borderRadius: t.radius.lg,
    backgroundColor: highlighted ? t.colors.primarySoft : 'transparent',
  };
  const content = (
    <>
      {leading ? <View>{leading}</View> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="subtitle" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? <View>{trailing}</View> : null}
    </>
  );
  if (!onPress) return <View style={base}>{content}</View>;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [base, { opacity: pressed ? 0.7 : 1 }]}>
      {content}
    </Pressable>
  );
}
