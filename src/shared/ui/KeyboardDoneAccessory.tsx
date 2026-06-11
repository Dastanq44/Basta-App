import { InputAccessoryView, Keyboard, Platform, Pressable, View } from 'react-native';
import { Text } from './Text';
import { useTheme } from './theme';

/** Shared accessory ID used by every multiline TextInput in the app (iOS only). */
export const KEYBOARD_DONE_ACCESSORY_ID = 'basta.keyboard.done';

/**
 * iOS-only "Done" bar above the keyboard. Renders nothing on Android.
 *
 * Mounted ONCE near the root so any TextInput in the tree can opt in by setting
 * `inputAccessoryViewID={KEYBOARD_DONE_ACCESSORY_ID}`. UIKit binds the accessory to
 * each focused input by id, so a single instance is enough across the whole app.
 *
 * Why this exists: multiline inputs (proof description, comment body, profile bio)
 * don't dismiss on Return — the key inserts a newline. The "Done" button gives the
 * user the iOS-native gesture they expect (T-053-E).
 */
export function KeyboardDoneAccessory() {
  const t = useTheme();
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={KEYBOARD_DONE_ACCESSORY_ID}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          alignItems: 'center',
          backgroundColor: t.colors.card,
          borderTopWidth: 1,
          borderTopColor: t.colors.border,
          paddingHorizontal: t.spacing.md,
          paddingVertical: 8,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Done — dismiss keyboard"
          hitSlop={8}
          onPress={() => Keyboard.dismiss()}
        >
          <Text style={{ color: t.colors.primary, fontSize: t.fontSize.md, fontWeight: '600' }}>
            Done
          </Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}
