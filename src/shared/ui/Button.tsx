import { ActivityIndicator, Pressable, type PressableProps, StyleSheet } from 'react-native';
import { Text } from './Text';
import { useTheme } from './theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

export type ButtonProps = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

/**
 * Button primitive — the `{variant: value}[variant]` token lookup IS the cva pattern,
 * minus the web layer (DECISIONS.md D-005). Accessibility (role, ≥44pt target) is built in.
 */
export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const t = useTheme();
  const bg: Record<Variant, string> = {
    primary: t.colors.primary,
    secondary: t.colors.secondary,
    ghost: 'transparent',
    destructive: t.colors.destructive,
  };
  const fg: Record<Variant, string> = {
    primary: t.colors.primaryForeground,
    secondary: t.colors.secondaryForeground,
    ghost: t.colors.foreground,
    destructive: t.colors.destructiveForeground,
  };
  // Retro look: secondary is an OUTLINED pill (foreground-colored border), the rest are flat fills.
  const borderColor: Record<Variant, string> = {
    primary: 'transparent',
    secondary: t.colors.foreground,
    ghost: 'transparent',
    destructive: 'transparent',
  };
  const borderWidth: Record<Variant, number> = { primary: 0, secondary: 1.5, ghost: 0, destructive: 0 };
  const paddingVertical: Record<Size, number> = { sm: 10, md: 13, lg: 16 };
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      hitSlop={8}
      style={(state) => [
        styles.base,
        {
          backgroundColor: bg[variant],
          borderColor: borderColor[variant],
          borderWidth: borderWidth[variant],
          paddingVertical: paddingVertical[size],
          // Fully-rounded pill — the Retro button shape.
          borderRadius: t.radius.full,
          minHeight: t.minTapTarget,
          opacity: isDisabled ? 0.5 : state.pressed ? 0.9 : 1,
          transform: [{ scale: state.pressed && !isDisabled ? 0.98 : 1 }],
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      {loading ? <ActivityIndicator color={fg[variant]} /> : <Text style={{ color: fg[variant], fontWeight: '600' }}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
});
