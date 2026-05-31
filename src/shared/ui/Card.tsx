import { View, type ViewProps } from 'react-native';
import { useTheme } from './theme';

/** Elevated surface primitive (card token) — flat with a faint lift, no border (Retro look). */
export function Card({ style, ...rest }: ViewProps) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.colors.card,
          borderRadius: t.radius.xl,
          padding: t.spacing.lg,
        },
        t.shadow.sm,
        style,
      ]}
      {...rest}
    />
  );
}
