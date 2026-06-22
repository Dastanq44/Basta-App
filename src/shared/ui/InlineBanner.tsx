import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { useTheme } from './theme';

export type InlineBannerTone = 'info' | 'warning' | 'success' | 'primary';

export type InlineBannerProps = {
  title?: string;
  message: string;
  tone?: InlineBannerTone;
  icon?: ReactNode;
  /** Optional trailing node (e.g. a small action). */
  right?: ReactNode;
  style?: ViewStyle;
};

/** A tinted, bordered inline banner for transient status (offline, queued, info). Tone tints both
 *  the background and border from one theme color so it reads on light + dark. */
export function InlineBanner({ title, message, tone = 'info', icon, right, style }: InlineBannerProps) {
  const t = useTheme();
  const color = { info: t.colors.primary, warning: t.colors.warning, success: t.colors.success, primary: t.colors.primary }[tone];
  return (
    <View
      accessibilityRole="summary"
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.spacing.sm,
          backgroundColor: color + '1A',
          borderColor: color + '55',
          borderWidth: 1,
          borderRadius: t.radius.md,
          paddingVertical: t.spacing.sm,
          paddingHorizontal: t.spacing.md,
        },
        style,
      ]}
    >
      {icon ? <View>{icon}</View> : null}
      <View style={{ flex: 1, gap: 1 }}>
        {title ? (
          <Text style={{ fontWeight: '700', color: t.colors.foreground, fontSize: t.fontSize.sm }}>{title}</Text>
        ) : null}
        <Text variant="caption" style={{ color: t.colors.mutedForeground }}>{message}</Text>
      </View>
      {right ?? null}
    </View>
  );
}
