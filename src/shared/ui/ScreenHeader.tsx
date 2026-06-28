import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from './Text';
import { useTheme } from './theme';
import { GlassIconButton } from './glass/GlassIconButton';
import { useGlassMode } from './glass/glassSupport';

export type ScreenHeaderProps = {
  /** Centered title. */
  title?: string;
  /** When provided, a left-aligned chevron button calls this on press. */
  onBack?: () => void;
  /** Optional right-slot button (e.g. the 3-dot icon). Provide both `icon` and `onPress`. */
  rightAction?: {
    icon: ReactNode;
    onPress: () => void;
    accessibilityLabel?: string;
  };
};

/**
 * In-body screen header — used as a replacement for the native iOS UINavigationBar on
 * screens where the system bar-button highlight (the white circular tap-tint that
 * fades in/out during screen transitions) is visible and undesirable.
 *
 * Render right at the top of the screen body when the screen has `headerShown: false`.
 * Buttons here are plain `<Pressable>`s with an opacity dip on press — no system
 * styling, no UIKit ornament, no native tap-highlight rectangle. Symmetric 40×40 slots
 * on either side keep the centered title visually balanced even when only one slot has
 * a button.
 */
export function ScreenHeader({ title, onBack, rightAction }: ScreenHeaderProps) {
  const t = useTheme();
  // On iOS 26 (Liquid Glass available) the back + action controls float in glass circles;
  // everywhere else they stay the lightweight plain Pressables (no glass dependency at runtime).
  const glass = useGlassMode() === 'liquid';

  return (
    <View
      style={{
        height: glass ? 52 : 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: t.spacing.sm,
      }}
    >
      {/* Left slot — back chevron or empty spacer to keep the title centered. */}
      {onBack ? (
        glass ? (
          <GlassIconButton icon={<BackChevron color={t.colors.foreground} />} onPress={onBack} accessibilityLabel="Back" />
        ) : (
          <HeaderBackButton onPress={onBack} />
        )
      ) : (
        <View style={{ width: glass ? 44 : 40, height: glass ? 44 : 40 }} />
      )}

      {/* Title — centered. flex: 1 so it absorbs the middle column. */}
      <Text
        variant="subtitle"
        numberOfLines={1}
        style={{
          flex: 1,
          textAlign: 'center',
          marginHorizontal: t.spacing.sm,
          color: t.colors.foreground,
        }}
      >
        {title ?? ''}
      </Text>

      {/* Right slot — action button or empty spacer. */}
      {rightAction ? (
        glass ? (
          <GlassIconButton icon={rightAction.icon} onPress={rightAction.onPress} accessibilityLabel={rightAction.accessibilityLabel} />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={rightAction.accessibilityLabel}
            onPress={rightAction.onPress}
            hitSlop={8}
            style={({ pressed }) => ({
              width: 40,
              height: 40,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.5 : 1,
            })}
          >
            {rightAction.icon}
          </Pressable>
        )
      ) : (
        <View style={{ width: glass ? 44 : 40, height: glass ? 44 : 40 }} />
      )}
    </View>
  );
}

/** Dep-free back chevron drawn from a single rotated View (used inside the glass back button). */
function BackChevron({ color }: { color: string }) {
  return (
    <View
      style={{
        width: 11,
        height: 11,
        borderTopWidth: 2.2,
        borderLeftWidth: 2.2,
        borderColor: color,
        transform: [{ rotate: '-45deg' }],
        marginLeft: 3,
      }}
    />
  );
}

/** Standalone back chevron — used both here and as the native-stack `headerLeft`
 *  for any screens still relying on the system header. Dep-free chevron drawn from a
 *  single rotated `View`. */
export function HeaderBackButton({ onPress }: { onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.5 : 1,
      })}
    >
      <View
        style={{
          width: 11,
          height: 11,
          borderTopWidth: 2.2,
          borderLeftWidth: 2.2,
          borderColor: t.colors.foreground,
          transform: [{ rotate: '-45deg' }],
        }}
      />
    </Pressable>
  );
}
