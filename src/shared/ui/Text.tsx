import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { useTheme } from './theme';

type Variant = 'title' | 'heading' | 'subtitle' | 'body' | 'muted' | 'caption' | 'label';

export type TextProps = RNTextProps & { variant?: Variant };

type VariantStyle = {
  fontSize: number;
  color: string;
  fontWeight: '400' | '500' | '600' | '700' | '800';
  lineHeight: number;
  letterSpacing?: number;
  fontFamily?: string;
};

/** Typography primitive. Pulls size/color/weight from semantic tokens by variant (system sans). */
export function Text({ variant = 'body', style, ...rest }: TextProps) {
  const t = useTheme();
  const byVariant: Record<Variant, VariantStyle> = {
    title: { fontFamily: t.fonts.display, fontSize: t.fontSize.xxl, color: t.colors.foreground, fontWeight: '800', lineHeight: t.fontSize.xxl * 1.15, letterSpacing: -0.6 },
    heading: { fontFamily: t.fonts.display, fontSize: t.fontSize.lg, color: t.colors.foreground, fontWeight: '700', lineHeight: t.fontSize.lg * 1.25, letterSpacing: -0.3 },
    subtitle: { fontFamily: t.fonts.body, fontSize: t.fontSize.md, color: t.colors.foreground, fontWeight: '600', lineHeight: t.fontSize.md * 1.3 },
    body: { fontFamily: t.fonts.body, fontSize: t.fontSize.md, color: t.colors.foreground, fontWeight: '400', lineHeight: t.fontSize.md * 1.45 },
    muted: { fontFamily: t.fonts.body, fontSize: t.fontSize.md, color: t.colors.mutedForeground, fontWeight: '400', lineHeight: t.fontSize.md * 1.45 },
    caption: { fontFamily: t.fonts.body, fontSize: t.fontSize.sm, color: t.colors.mutedForeground, fontWeight: '500', lineHeight: t.fontSize.sm * 1.35 },
    // Small, tracked, uppercase-friendly eyebrow label (e.g. section kickers, stat captions).
    label: { fontFamily: t.fonts.body, fontSize: t.fontSize.xs, color: t.colors.mutedForeground, fontWeight: '700', lineHeight: t.fontSize.xs * 1.3, letterSpacing: 0.4 },
  };
  return <RNText style={[byVariant[variant], style]} {...rest} />;
}
