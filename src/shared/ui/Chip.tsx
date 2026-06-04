import { Pressable } from 'react-native';
import { Text } from './Text';
import { useTheme } from './theme';

export type ChipProps = { label: string; selected?: boolean; onPress?: () => void };

/** Filter pill — violet when selected, soft gray when not (the reference's category chips). */
export function Chip({ label, selected = false, onPress }: ChipProps) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderRadius: t.radius.full,
        backgroundColor: selected ? t.colors.primary : t.colors.secondary,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ color: selected ? t.colors.primaryForeground : t.colors.secondaryForeground, fontWeight: '600', fontSize: t.fontSize.sm }}>
        {label}
      </Text>
    </Pressable>
  );
}
