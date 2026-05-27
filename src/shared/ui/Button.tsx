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
  const paddingVertical: Record<Size, number> = { sm: 8, md: 12, lg: 16 };
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
          paddingVertical: paddingVertical[size],
          borderRadius: t.radius.md,
          minHeight: t.minTapTarget,
          opacity: isDisabled ? 0.5 : state.pressed ? 0.85 : 1,
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
