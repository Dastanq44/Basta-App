import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { useTheme } from './theme';

type Variant = 'title' | 'heading' | 'body' | 'muted' | 'caption';

export type TextProps = RNTextProps & { variant?: Variant };

type VariantStyle = {
  fontSize: number;
  color: string;
  fontWeight: '400' | '500' | '600' | '700' | '800';
  lineHeight: number;
  letterSpacing?: number;
  fontFamily?: string;
};

/** Typography primitive. Pulls size/color/face from semantic tokens by variant. */
export function Text({ variant = 'body', style, ...rest }: TextProps) {
  const t = useTheme();
  const byVariant: Record<Variant, VariantStyle> = {
    // title/heading use the serif display face (Retro look); body/muted/caption stay system sans.
    title: { fontFamily: t.fonts.display, fontSize: t.fontSize.xxl, color: t.colors.foreground, fontWeight: '700', lineHeight: t.fontSize.xxl * 1.1, letterSpacing: -0.5 },
    heading: { fontFamily: t.fonts.display, fontSize: t.fontSize.xl, color: t.colors.foreground, fontWeight: '700', lineHeight: t.fontSize.xl * 1.18, letterSpacing: -0.2 },
    body: { fontFamily: t.fonts.body, fontSize: t.fontSize.md, color: t.colors.foreground, fontWeight: '400', lineHeight: t.fontSize.md * 1.45 },
    muted: { fontFamily: t.fonts.body, fontSize: t.fontSize.md, color: t.colors.mutedForeground, fontWeight: '400', lineHeight: t.fontSize.md * 1.45 },
    caption: { fontFamily: t.fonts.body, fontSize: t.fontSize.sm, color: t.colors.mutedForeground, fontWeight: '500', lineHeight: t.fontSize.sm * 1.35 },
  };
  return <RNText style={[byVariant[variant], style]} {...rest} />;
}
