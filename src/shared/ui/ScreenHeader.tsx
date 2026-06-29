import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { Text } from './Text';
import { Icon } from './Icon';
import { useTheme } from './theme';
import { ChevronLeftIcon } from './ChevronLeftIcon';
import { GlassIconButton } from './glass/GlassIconButton';

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
 * In-body app header — the single header strategy for app-owned screens (`headerShown: false`).
 * Back + action controls are ALWAYS rendered as `GlassIconButton` circles, so the shape language is
 * identical on every screen and platform: real Liquid Glass on iOS 26, a frosted blur fallback on
 * older iOS / Android, and a solid themed circle under Reduce Transparency. The back chevron is the
 * shared `ChevronLeftIcon` (optically centered, no per-screen margin hacks). 44×44 slots keep the
 * centered title balanced. Title uses the theme foreground (readable in every theme).
 */
export function ScreenHeader({ title, onBack, rightAction }: ScreenHeaderProps) {
  const t = useTheme();
  return (
    <View
      style={{
        height: 52,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: t.spacing.sm,
      }}
    >
      {/* Left slot — glass back circle or empty spacer to keep the title centered. */}
      {onBack ? (
        <GlassIconButton icon={<ChevronLeftIcon />} onPress={onBack} accessibilityLabel="Back" />
      ) : (
        <View style={{ width: 44, height: 44 }} />
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

      {/* Right slot — glass action circle or empty spacer. */}
      {rightAction ? (
        <GlassIconButton icon={rightAction.icon} onPress={rightAction.onPress} accessibilityLabel={rightAction.accessibilityLabel} />
      ) : (
        <View style={{ width: 44, height: 44 }} />
      )}
    </View>
  );
}

/**
 * Standalone right-slot action for native stack headers (`headerRight`) — e.g. the 3-dot menu.
 * A flat, Apple-style bar button (no glass capsule): just the icon, theme-tinted, with an opacity
 * dim on press. It sits in the system nav bar opposite the back chevron. Defaults to the 3-dot
 * "more" glyph; pass `icon` to override.
 */
export function HeaderActionButton({
  onPress,
  accessibilityLabel,
  icon,
}: {
  onPress: () => void;
  accessibilityLabel?: string;
  icon?: ReactNode;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
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
      {icon ?? <Icon name="settings" size={22} color={t.colors.foreground} />}
    </Pressable>
  );
}

/**
 * The single source of truth for native stack header chrome. Spread into a navigator's
 * `screenOptions` so EVERY native-header stack (the root stack AND the nested (auth) stack) shows
 * identical controls: the shared flat `ChevronLeftIcon` back button (no system chevron / "Back"
 * text / tap-highlight), a centered themed title, and a transparent themed bar. Set `headerShown`
 * yourself — this only owns the chrome, not visibility.
 */
export function useAppStackScreenOptions(): NativeStackNavigationOptions {
  const t = useTheme();
  const router = useRouter();
  return {
    // Belt-and-suspenders against RN-nav version differences: both hide the native back-text.
    headerBackTitle: '',
    headerBackButtonDisplayMode: 'minimal',
    headerLeft: ({ canGoBack }) => (canGoBack ? <HeaderBackButton onPress={() => router.back()} /> : null),
    // Bar matches the screen background (no contrasting strip); tint + title follow the foreground.
    headerStyle: { backgroundColor: t.colors.background },
    headerTintColor: t.colors.foreground,
    headerTitleStyle: { color: t.colors.foreground },
    // Centered title on every platform (Android left-aligns by default): back · title · action.
    headerTitleAlign: 'center',
    headerShadowVisible: false,
  };
}

/** Standalone back control for the few routes still on a native stack header (`headerLeft`).
 *  Uses the same shared SVG chevron, optically centered, theme-aware. */
export function HeaderBackButton({ onPress }: { onPress: () => void }) {
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
      <ChevronLeftIcon />
    </Pressable>
  );
}
