import { StyleSheet, View, type ViewProps } from 'react-native';
import { useTheme } from './theme';

/** Elevated surface primitive (card token) — rounded, soft diffused lift + a hairline
 *  border (subtle on light, gives definition on dark). */
export function Card({ style, ...rest }: ViewProps) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.colors.card,
          borderRadius: t.radius.xl,
          padding: t.spacing.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.colors.border,
        },
        t.shadow.sm,
        style,
      ]}
      {...rest}
    />
  );
}
