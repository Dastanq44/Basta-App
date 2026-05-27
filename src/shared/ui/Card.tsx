import { View, type ViewProps } from 'react-native';
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
          borderWidth: StyleSheetHairline,
          borderRadius: t.radius.lg,
          padding: t.spacing.md,
        },
        style,
      ]}
      {...rest}
    />
  );
}

// Hairline border that respects device pixel density.
const StyleSheetHairline = 1;
