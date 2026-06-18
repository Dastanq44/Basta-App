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
    <View style={{ alignItems: 'center', gap: 3, paddingVertical: t.spacing.md }}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={{ width: 112, height: 112, borderRadius: 56 }} />
      ) : (
        <Avatar name={displayName} size={112} />
      )}
      <Text
        style={{ textAlign: 'center', marginTop: t.spacing.sm, fontSize: t.fontSize.xxl, fontWeight: '800', color: t.colors.foreground }}
        numberOfLines={1}
      >
        {displayName}
      </Text>
      {username ? (
        <Text style={{ textAlign: 'center', fontSize: t.fontSize.md, color: t.colors.mutedForeground }} numberOfLines={1}>
          {username}
        </Text>
      ) : null}
      {description ? (
        <Text
          style={{ textAlign: 'center', paddingHorizontal: t.spacing.md, marginTop: 4, fontSize: t.fontSize.md, color: t.colors.foreground }}
          numberOfLines={4}
        >
          {description}
        </Text>
      ) : null}
    </View>
  );
}
