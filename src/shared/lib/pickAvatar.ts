import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export type PickAvatarResult =
  | { kind: 'picked'; uri: string }
  | { kind: 'removed' }
  | { kind: 'cancelled' };

export type PickAvatarOptions = {
  /** When true, the action sheet includes a destructive "Remove photo" button. */
  allowRemove?: boolean;
  /** Header title for the action sheet. Defaults to "Photo". */
  title?: string;
};

/**
 * Show an action sheet → camera / library / (remove) / cancel. Returns the resolved
 * choice as a tagged union.
 *
 * NOTE on the expo-image-picker deprecation warning: `MediaTypeOptions.Images` was
 * deprecated in favour of the `MediaType` enum / string literal. The shape that works on
 * both old (SDK ≤53) and new (SDK 54+) versions is the literal-array form
 * `mediaTypes: ['images']`, which the runtime accepts in both eras. We use that here to
 * silence the warning without introducing a hard floor on the picker version.
 */
export function pickAvatar(options: PickAvatarOptions = {}): Promise<PickAvatarResult> {
  const { allowRemove = false, title = 'Photo' } = options;
  return new Promise<PickAvatarResult>((resolve) => {
    type SheetBtn = { text: string; style?: 'cancel' | 'destructive' | 'default'; onPress?: () => void };
    const buttons: SheetBtn[] = [
      {
        text: 'Take photo',
        onPress: () => {
          void takePhoto().then(resolve).catch(() => resolve({ kind: 'cancelled' }));
        },
      },
      {
        text: 'Choose from library',
        onPress: () => {
          void chooseFromLibrary().then(resolve).catch(() => resolve({ kind: 'cancelled' }));
        },
      },
    ];
    if (allowRemove) {
      buttons.push({
        text: 'Remove photo',
        style: 'destructive',
        onPress: () => resolve({ kind: 'removed' }),
      });
    }
    buttons.push({ text: 'Cancel', style: 'cancel', onPress: () => resolve({ kind: 'cancelled' }) });

    Alert.alert(title, undefined, buttons, { cancelable: true, onDismiss: () => resolve({ kind: 'cancelled' }) });
  });
}

async function takePhoto(): Promise<PickAvatarResult> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return { kind: 'cancelled' };
  const res = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: true,
    aspect: [1, 1],
  });
  const asset = res.canceled ? undefined : res.assets?.[0];
  return asset?.uri ? { kind: 'picked', uri: asset.uri } : { kind: 'cancelled' };
}

async function chooseFromLibrary(): Promise<PickAvatarResult> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { kind: 'cancelled' };
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: true,
    aspect: [1, 1],
  });
  const asset = res.canceled ? undefined : res.assets?.[0];
  return asset?.uri ? { kind: 'picked', uri: asset.uri } : { kind: 'cancelled' };
}
