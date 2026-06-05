import type { ReactNode } from 'react';
import { Modal, Pressable, Text as RNText, View } from 'react-native';
import { useTheme } from './theme';

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Top hairline-rounded drag handle (40×4 dot at the top). Default true. */
  showHandle?: boolean;
};

/**
 * Bottom sheet that slides up from the bottom as one body — backdrop + sheet animate
 * together. Built on RN's <Modal animationType="slide" /> which moves the modal contents
 * up from the bottom edge as a single layer; we put the dark backdrop INSIDE the modal so
 * it rides up with the sheet (instead of fading-in separately, which is what the previous
 * `animationType="fade"` implementation looked like).
 *
 * Tapping outside the sheet closes it. The inner Pressable absorbs taps so the dismiss
 * gesture only triggers from the backdrop, not the sheet itself.
 */
export function BottomSheet({ visible, onClose, children, showHandle = true }: BottomSheetProps) {
  const t = useTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: t.colors.card,
            borderTopLeftRadius: t.radius.xl,
            borderTopRightRadius: t.radius.xl,
            padding: t.spacing.lg,
            paddingBottom: t.spacing.xl,
            gap: t.spacing.xs,
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
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export type BottomSheetMenuItemProps = {
  label: string;
  destructive?: boolean;
  onPress: () => void;
};

/** Standard menu item for inside a BottomSheet — centered label, large tap target. The
 *  same look the prior inline MenuItems used in the group sheet, factored out so it can
 *  be shared by the new Profile + Challenge sheets too. */
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
