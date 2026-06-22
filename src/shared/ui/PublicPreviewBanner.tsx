import { View, type ViewStyle } from 'react-native';
import { Button } from './Button';
import { OrnamentMedallion } from './OrnamentMedallion';
import { Text } from './Text';
import { useTheme } from './theme';

export type PublicPreviewBannerProps = {
  /** Bold title. Defaults to "Public preview". */
  title?: string;
  /** Explains the read-only nature + how to get full access. */
  message: string;
  /** Optional inline join CTA (screens may also keep a sticky button at the bottom). */
  ctaLabel?: string;
  onCta?: () => void;
  style?: ViewStyle;
};

/**
 * A prominent "read-only public preview" banner — a sky-tinted panel with a small steppe
 * medallion, a "Read-only" chip, and an optional join CTA. Stronger than a plain InlineBanner
 * so the read-only state reads at a glance on public challenge / group previews.
 */
export function PublicPreviewBanner({ title = 'Public preview', message, ctaLabel, onCta, style }: PublicPreviewBannerProps) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="summary"
      style={[
        {
          backgroundColor: t.colors.primarySoft,
          borderColor: t.colors.primary + '40',
          borderWidth: 1,
          borderRadius: t.radius.xl,
          padding: t.spacing.lg,
          gap: t.spacing.md,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', gap: t.spacing.md, alignItems: 'flex-start' }}>
        <OrnamentMedallion size={44} background="transparent" />
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
            <Text variant="subtitle" style={{ color: t.colors.foreground }}>{title}</Text>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: t.radius.full,
                backgroundColor: t.colors.primary,
              }}
            >
              <Text style={{ color: t.colors.primaryForeground, fontSize: t.fontSize.xs, fontWeight: '700' }}>
                Read-only
              </Text>
            </View>
          </View>
          <Text variant="caption" style={{ color: t.colors.foreground, opacity: 0.8 }}>{message}</Text>
        </View>
      </View>
      {ctaLabel && onCta ? <Button label={ctaLabel} onPress={onCta} /> : null}
    </View>
  );
}
