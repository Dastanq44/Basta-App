import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  Text as RNText,
  useWindowDimensions,
  View,
} from 'react-native';
import { useTheme } from './theme';

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Top hairline-rounded drag handle (40×4 dot at the top). Default true. */
  showHandle?: boolean;
};

const OPEN_DURATION = 260;
const CLOSE_DURATION = 200;
const BACKDROP_OPACITY = 0.4;

/**
 * Bottom sheet whose backdrop FADES in while the sheet slides up. Decoupling those two
 * animations was the user-visible fix: the prior `<Modal animationType="slide">` made the
 * dark tint slide up along with the sheet, which read as "the tint is rising too".
 *
 * Implementation:
 *  - `<Modal animationType="none">` so RN doesn't drive any animation itself.
 *  - One `Animated.Value` for backdrop opacity (0 → 0.4).
 *  - One `Animated.Value` for the sheet's translateY (off-screen → 0).
 *  - Both run in parallel on open; reversed on close. The Modal stays mounted until the
 *    close animation finishes, then we unmount it (so the close animation isn't cut off).
 *
 * Sheet height isn't known in advance; we translate by the window height as a "safe upper
 * bound" so the sheet starts fully off-screen below regardless of content size.
 */
export function BottomSheet({ visible, onClose, children, showHandle = true }: BottomSheetProps) {
  const t = useTheme();
  const { height: winH } = useWindowDimensions();
  const backdrop = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(winH)).current;

  // Keep the Modal mounted through the closing animation so the slide-down + fade-out
  // are visible. `mounted` tracks render state independently of the controlling prop.
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      // Reset to off-screen / transparent before opening, in case the prior close was
      // interrupted partway.
      backdrop.setValue(0);
      sheetY.setValue(winH);
      Animated.parallel([
        Animated.timing(backdrop, { toValue: BACKDROP_OPACITY, duration: OPEN_DURATION, useNativeDriver: true }),
        Animated.timing(sheetY, { toValue: 0, duration: OPEN_DURATION, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 0, duration: CLOSE_DURATION, useNativeDriver: true }),
        Animated.timing(sheetY, { toValue: winH, duration: CLOSE_DURATION, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, mounted, backdrop, sheetY, winH]);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1 }}>
        {/* Backdrop — fades, doesn't translate. Tap dismisses. */}
        <Animated.View
          style={{
            ...StyleSheetFlatten.fill,
            backgroundColor: 'black',
            opacity: backdrop,
          }}
        >
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>

        {/* Sheet — slides up, doesn't fade. Pinned to the bottom. */}
        <Animated.View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: t.colors.card,
            borderTopLeftRadius: t.radius.xl,
            borderTopRightRadius: t.radius.xl,
            padding: t.spacing.lg,
            paddingBottom: t.spacing.xl,
            transform: [{ translateY: sheetY }],
          }}
        >
          {showHandle ? (
            <View
              style={{
                alignSelf: 'center',
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: t.colors.border,
                marginBottom: t.spacing.sm,
              }}
            />
          ) : null}
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const StyleSheetFlatten = {
  fill: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 },
};

export type BottomSheetMenuItemProps = {
  label: string;
  destructive?: boolean;
  onPress: () => void;
};

/** Standard menu item for inside a BottomSheet — centered label, large tap target. */
export function BottomSheetMenuItem({ label, destructive, onPress }: BottomSheetMenuItemProps) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: 14,
        paddingHorizontal: t.spacing.sm,
        borderRadius: t.radius.md,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <RNText
        style={{
          color: destructive ? t.colors.destructive : t.colors.foreground,
          textAlign: 'center',
          fontSize: t.fontSize.md,
          fontWeight: '600',
        }}
      >
        {label}
      </RNText>
    </Pressable>
  );
}
