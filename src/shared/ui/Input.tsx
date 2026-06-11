import { forwardRef, useState } from 'react';
import { Platform, TextInput as RNTextInput, type TextInputProps, View } from 'react-native';
import { Text } from './Text';
import { useTheme } from './theme';
import { KEYBOARD_DONE_ACCESSORY_ID } from './KeyboardDoneAccessory';

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

  // iOS multiline inputs don't dismiss on Return (the key inserts a newline). Attach
  // the shared <KeyboardDoneAccessory /> by default so the user always gets a
  // native "Done" affordance above the keyboard (T-053-E). Caller can override by
  // passing their own `inputAccessoryViewID` or explicitly setting it to undefined.
  const accessoryId =
    rest.inputAccessoryViewID ??
    (Platform.OS === 'ios' && rest.multiline ? KEYBOARD_DONE_ACCESSORY_ID : undefined);

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
          {
            // Thicker border on focus gives a clear, accessible focus ring without a glow layer.
            borderWidth: focused ? 2 : 1,
            borderColor,
            borderRadius: t.radius.lg,
            color: t.colors.foreground,
            backgroundColor: t.colors.card,
            paddingHorizontal: t.spacing.md,
            paddingVertical: t.spacing.sm,
            fontSize: t.fontSize.md,
            minHeight: 50,
          },
        ]}
        {...rest}
        inputAccessoryViewID={accessoryId}
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
