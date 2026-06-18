import { Image, View } from 'react-native';
import { Avatar, Text, useTheme } from '@/shared/ui';

export type ProfileHeaderProps = {
  avatarUrl: string | null;
  displayName: string;
  username: string | null;
  description?: string;
};

/** Compact identity block: avatar + name + @username + optional bio. Empty bio/username collapse
 *  (no awkward blank space). Avatar is prominent but not oversized (88pt). */
export function ProfileHeader({ avatarUrl, displayName, username, description }: ProfileHeaderProps) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 2, paddingVertical: t.spacing.sm }}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={{ width: 88, height: 88, borderRadius: 44 }} />
      ) : (
        <Avatar name={displayName} size={88} />
      )}
      <Text variant="heading" style={{ textAlign: 'center', marginTop: t.spacing.xs }} numberOfLines={1}>
        {displayName}
      </Text>
      {username ? (
        <Text variant="muted" style={{ textAlign: 'center' }} numberOfLines={1}>
          {username}
        </Text>
      ) : null}
      {description ? (
        <Text variant="body" style={{ textAlign: 'center', paddingHorizontal: t.spacing.md, marginTop: 2 }} numberOfLines={4}>
          {description}
        </Text>
      ) : null}
    </View>
  );
}
