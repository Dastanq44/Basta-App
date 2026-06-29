import { useRef, type ReactNode } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { useTheme } from '../theme';
import { GlassSurface } from './GlassSurface';

export type GlassIconButtonProps = {
  icon: ReactNode;
  onPress: () => void;
  accessibilityLabel?: string;
  /** Diameter (≥44 for the tap target). */
  size?: number;
  /** Tinted (active) state — fills the glass with a soft primary tint. */
  active?: boolean;
};

/** A circular Liquid-Glass control (back chevron, 3-dot, etc.) with a subtle spring on press.
 *  Meets the 44pt tap target. Use for floating navigation actions, not content. */
export function GlassIconButton({ icon, onPress, accessibilityLabel, size = 44, active = false }: GlassIconButtonProps) {
  const t = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const spring = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 8 }).start();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onPressIn={() => spring(0.9)}
      onPressOut={() => spring(1)}
      hitSlop={6}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <GlassSurface
          // Inactive controls use the lighter 'clear' tone so light themes don't read as a muddy
          // grey disc; the active state fills with a soft primary tint at 'regular' frost.
          tone={active ? 'regular' : 'clear'}
          radius={size / 2}
          tintColor={active ? t.colors.primary : undefined}
          style={{ width: size, height: size }}
        >
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>{icon}</View>
        </GlassSurface>
      </Animated.View>
    </Pressable>
  );
}
