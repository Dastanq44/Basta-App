import { StyleSheet, View, type ViewProps } from 'react-native';
import { useTheme } from './theme';

/** Elevated surface primitive (card/card-foreground tokens). */
export function Card({ style, ...rest }: ViewProps) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.colors.card,
          borderColor: t.colors.border,
          // Thinnest line the device can render (density-aware), not a hard-coded 1px.
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: t.radius.lg,
          padding: t.spacing.md,
        },
        style,
      ]}
      {...rest}
    />
  );
}
