import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Text } from '../Text';
import { useTheme } from '../theme';
import { ChevronLeftIcon } from '../ChevronLeftIcon';
import { GlassIconButton } from './GlassIconButton';

export type GlassHeaderProps = {
  title?: string;
  /** Back chevron (glass circle) when provided. */
  onBack?: () => void;
  /** Optional right-slot glass action (e.g. the 3-dot menu). */
  rightAction?: {
    icon: ReactNode;
    onPress: () => void;
    accessibilityLabel?: string;
  };
};

/**
 * Floating compact header for detail screens — a drop-in replacement for ScreenHeader, but with
 * the back + action controls rendered as Liquid-Glass circles (frosted fallback elsewhere). The
 * title sits in the open between them. Lighter and more premium than a boxed bar; on iOS 26 it
 * reads as floating glass, on Android/older iOS as a soft frosted pill.
 */
export function GlassHeader({ title, onBack, rightAction }: GlassHeaderProps) {
  const t = useTheme();
  return (
    <View
      style={{
        height: 52,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: t.spacing.md,
      }}
    >
      {onBack ? (
        <GlassIconButton icon={<ChevronLeftIcon />} onPress={onBack} accessibilityLabel="Back" />
      ) : (
        <View style={{ width: 44, height: 44 }} />
      )}

      <Text
        variant="subtitle"
        numberOfLines={1}
        style={{ flex: 1, textAlign: 'center', marginHorizontal: t.spacing.sm, color: t.colors.foreground }}
      >
        {title ?? ''}
      </Text>

      {rightAction ? (
        <GlassIconButton icon={rightAction.icon} onPress={rightAction.onPress} accessibilityLabel={rightAction.accessibilityLabel} />
      ) : (
        <View style={{ width: 44, height: 44 }} />
      )}
    </View>
  );
}
