import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, type PressableProps, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { useTheme } from './theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'sm' | 'md' | 'lg';

export type ButtonProps = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Optional leading icon rendered before the label. */
  icon?: ReactNode;
};

/**
 * Button primitive — the `{variant: value}[variant]` token lookup IS the cva pattern,
 * minus the web layer (DECISIONS.md D-005). Accessibility (role, ≥44pt target) is built in.
 * Sleek-violet look: solid pills; the primary CTA gets a soft violet glow.
 */
export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
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
  const paddingVertical: Record<Size, number> = { sm: 10, md: 14, lg: 17 };
  const isDisabled = disabled || loading;
  // Soft violet lift under the primary CTA only (the rest stay flat).
  const glow = variant === 'primary' && !isDisabled;

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
          borderRadius: t.radius.full,
          minHeight: t.minTapTarget,
          opacity: isDisabled ? 0.5 : state.pressed ? 0.92 : 1,
          transform: [{ scale: state.pressed && !isDisabled ? 0.98 : 1 }],
        },
        glow
          ? {
              shadowColor: t.colors.primary,
              shadowOpacity: 0.35,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 },
              elevation: 6,
            }
          : null,
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={fg[variant]} />
      ) : (
        <View style={styles.content}>
          {icon ? <View>{icon}</View> : null}
          <Text style={{ color: fg[variant], fontWeight: '700' }}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
