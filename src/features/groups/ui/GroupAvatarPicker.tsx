import * as ImagePicker from 'expo-image-picker';
import { Image, Pressable, View } from 'react-native';
import { Text, useTheme } from '@/shared/ui';

export type GroupAvatarPickerProps = {
  /** Local URI (just picked) or remote URL (existing avatar) to preview. */
  uri?: string | null;
  onPick: (localUri: string) => void;
  size?: number;
};

/** Circular avatar picker — taps open the photo library, square-cropped. Used by create + edit. */
export function GroupAvatarPicker({ uri, onPick, size = 88 }: GroupAvatarPickerProps) {
  const t = useTheme();
  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    const asset = res.canceled ? undefined : res.assets?.[0];
    if (asset?.uri) onPick(asset.uri);
  };
  return (
    <Pressable accessibilityRole="button" onPress={pick} style={{ alignSelf: 'center' }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: t.colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: t.colors.border,
        }}
      >
        {uri ? <Image source={{ uri }} style={{ width: size, height: size }} /> : <Text style={{ fontSize: size * 0.4 }}>📷</Text>}
      </View>
      <Text variant="caption" style={{ textAlign: 'center', marginTop: 6, color: t.colors.primary }}>
        {uri ? 'Change photo' : 'Add photo'}
      </Text>
    </Pressable>
  );
}
