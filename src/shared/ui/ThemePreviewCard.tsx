import { memo } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Text } from './Text';
import { useTheme } from './theme';
import { THEMES } from './theme/tokens';
import type { ThemeId } from '@/shared/lib/appPreferences';

export type ThemePreviewCardProps = {
  themeId: ThemeId;
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  style?: ViewStyle;
};

/**
 * A selectable theme card showing a MINI fake screen rendered in that theme's own tokens (so the
 * user feels the theme before choosing it): background + card + primary button + a small steppe
 * medallion accent. Selected state highlights with the ACTIVE theme's primary so the choice reads.
 */
export const ThemePreviewCard = memo(function ThemePreviewCard({
  themeId,
  label,
  description,
  selected,
  onPress,
  style,
}: ThemePreviewCardProps) {
  const t = useTheme();
  const c = THEMES[themeId].colors; // preview uses the target theme's palette, not the active one

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        {
          flex: 1,
          borderRadius: t.radius.xl,
          borderWidth: 2,
          borderColor: selected ? t.colors.primary : t.colors.border,
          backgroundColor: t.colors.card,
          padding: t.spacing.sm,
          gap: t.spacing.sm,
          minHeight: 44,
        },
        selected ? t.shadow.sm : null,
        style,
      ]}
    >
      {/* Mini fake screen in the target theme's tokens. */}
      <View style={{ height: 92, borderRadius: t.radius.lg, backgroundColor: c.background, padding: 8, gap: 6, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ height: 7, width: 38, borderRadius: 4, backgroundColor: c.foreground, opacity: 0.85 }} />
          <Svg width={16} height={16} viewBox="0 0 64 64">
            <Path d="M32 12 L52 32 L32 52 L12 32 Z" fill="none" stroke={c.accent} strokeWidth={4} />
            <Path d="M32 26 L38 32 L32 38 L26 32 Z" fill={c.accent} />
          </Svg>
        </View>
        <View style={{ flex: 1, borderRadius: 10, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, padding: 7, gap: 5, justifyContent: 'center' }}>
          <View style={{ height: 6, width: '70%', borderRadius: 3, backgroundColor: c.foreground, opacity: 0.8 }} />
          <View style={{ height: 5, width: '45%', borderRadius: 3, backgroundColor: c.mutedForeground }} />
          <View style={{ height: 16, width: 56, borderRadius: 8, backgroundColor: c.primary, marginTop: 2 }} />
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}>
        <View style={{ flex: 1 }}>
          <Text variant="subtitle" numberOfLines={1} style={{ color: selected ? t.colors.primary : t.colors.foreground }}>
            {label}
          </Text>
          {description ? <Text variant="caption" numberOfLines={2}>{description}</Text> : null}
        </View>
        <View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            borderWidth: 2,
            borderColor: selected ? t.colors.primary : t.colors.border,
            backgroundColor: selected ? t.colors.primary : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected ? (
            <View style={{ width: 8, height: 5, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: t.colors.primaryForeground, transform: [{ rotate: '-45deg' }], marginTop: -2 }} />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});
