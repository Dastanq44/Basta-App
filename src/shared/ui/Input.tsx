import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput as RNTextInput, type TextInputProps, View } from 'react-native';
import { Text } from './Text';
import { useTheme } from './theme';

export type InputProps = Omit<TextInputProps, 'style'> & {
  label?: string;
  error?: string;
  hint?: string;
};

/**
 * Text input primitive — token-driven, accessible, with optional label + error display.
 * Follows the same pattern as Button (semantic tokens, ≥44pt target).
 */
export const Input = forwardRef<RNTextInput, InputProps>(function Input(
  { label, error, hint, accessibilityLabel, ...rest },
  ref,
) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error
    ? t.colors.destructive
    : focused
      ? t.colors.ring
      : t.colors.border;

  return (
    <View style={{ gap: t.spacing.xs }}>
      {label ? <Text variant="caption">{label}</Text> : null}
      <RNTextInput
        ref={ref}
        accessibilityLabel={accessibilityLabel ?? label}
        placeholderTextColor={t.colors.mutedForeground}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={[
          styles.input,
          {
            borderColor,
            borderRadius: t.radius.md,
            color: t.colors.foreground,
            backgroundColor: t.colors.background,
            paddingHorizontal: t.spacing.md,
            fontSize: t.fontSize.md,
            minHeight: t.minTapTarget,
          },
        ]}
        {...rest}
      />
      {error ? (
        <Text variant="caption" style={{ color: t.colors.destructive }}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption">{hint}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  input: { borderWidth: StyleSheet.hairlineWidth },
});
