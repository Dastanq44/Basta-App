import { Image, Pressable, View } from 'react-native';
import { Text, useTheme } from '@/shared/ui';
import { pickAvatar } from '@/shared/lib/pickAvatar';

export type GroupAvatarPickerProps = {
  /** Local URI (just picked) or remote URL (existing avatar) to preview. */
  uri?: string | null;
  /** Called when the user picks a new image (camera or library). */
  onPick: (localUri: string) => void;
  /** Called when the user taps "Remove photo" — only available when `uri` is set. */
  onRemove?: () => void;
  size?: number;
};

/**
 * Circular avatar picker — taps open a Take photo / From library / (Remove) action sheet
 * via the shared `pickAvatar` helper. The picker can both upload from library AND take a
 * new photo (per the user's D fix). Remove is offered only when an avatar already exists.
 */
export function GroupAvatarPicker({ uri, onPick, onRemove, size = 88 }: GroupAvatarPickerProps) {
  const t = useTheme();
  const hasAvatar = !!uri;

  const onPress = async () => {
    const res = await pickAvatar({
      allowRemove: hasAvatar && !!onRemove,
      title: hasAvatar ? 'Change group photo' : 'Add group photo',
    });
    if (res.kind === 'picked') onPick(res.uri);
    else if (res.kind === 'removed' && onRemove) onRemove();
  };

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ alignSelf: 'center' }}>
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
        {uri ? (
          <Image source={{ uri }} style={{ width: size, height: size }} />
        ) : (
          <Text style={{ fontSize: size * 0.4 }}>📷</Text>
        )}
      </View>
      <Text variant="caption" style={{ textAlign: 'center', marginTop: 6, color: t.colors.primary }}>
        {hasAvatar ? 'Change photo' : 'Add photo'}
      </Text>
    </Pressable>
  );
}
