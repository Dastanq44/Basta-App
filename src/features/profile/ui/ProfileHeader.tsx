import { View } from 'react-native';
import { Avatar, OrnamentDivider, Text, useTheme } from '@/shared/ui';

export type ProfileHeaderProps = {
  avatarUrl: string | null;
  displayName: string;
  username: string | null;
  description?: string;
};

/** Compact identity block: avatar + name + @username + optional bio, closed by a subtle ornament
 *  band that marks the transition into the profile's tabbed content. Empty bio/username collapse. */
export function ProfileHeader({ avatarUrl, displayName, username, description }: ProfileHeaderProps) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 3, paddingTop: t.spacing.md, paddingBottom: t.spacing.sm }}>
      <Avatar name={displayName} uri={avatarUrl} size={112} />
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
      <OrnamentDivider style={{ marginTop: t.spacing.md, alignSelf: 'stretch', paddingHorizontal: t.spacing.xl }} />
    </View>
  );
}
