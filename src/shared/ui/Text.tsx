import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { useTheme } from './theme';

type Variant = 'title' | 'heading' | 'body' | 'muted' | 'caption';

export type TextProps = RNTextProps & { variant?: Variant };

/** Typography primitive. Pulls size/color from semantic tokens by variant. */
export function Text({ variant = 'body', style, ...rest }: TextProps) {
  const t = useTheme();
  const byVariant: Record<Variant, { fontSize: number; color: string; fontWeight: '400' | '600' | '700' }> = {
    title: { fontSize: t.fontSize.xl, color: t.colors.foreground, fontWeight: '700' },
    heading: { fontSize: t.fontSize.lg, color: t.colors.foreground, fontWeight: '600' },
    body: { fontSize: t.fontSize.md, color: t.colors.foreground, fontWeight: '400' },
    muted: { fontSize: t.fontSize.md, color: t.colors.mutedForeground, fontWeight: '400' },
    caption: { fontSize: t.fontSize.sm, color: t.colors.mutedForeground, fontWeight: '400' },
  };
  return <RNText style={[byVariant[variant], style]} {...rest} />;
}
