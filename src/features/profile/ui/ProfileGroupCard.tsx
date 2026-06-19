import { Image, Pressable, View } from 'react-native';
import { Avatar, Card, Text, useTheme } from '@/shared/ui';
import { groupAvatarUrl } from '@/features/groups';
import type { MemberRole } from '@/entities';
import type { ProfileGroup } from '../api';
import { Pill } from './Pill';

const ROLE_LABEL: Record<MemberRole, string> = { owner: 'Leader', admin: 'Admin', member: 'Member' };

export type ProfileGroupCardProps = {
  group: ProfileGroup;
  /** Provided only when the viewer can open the group (member). */
  onPress?: () => void;
  isOwn: boolean;
};

/** Group card for the profile Groups tab. Always tappable — the group route decides full member
 *  detail vs read-only public preview. Never shows the invite code. */
export function ProfileGroupCard({ group, onPress, isOwn }: ProfileGroupCardProps) {
  const t = useTheme();
  const avatarUrl = groupAvatarUrl(group.avatarPath);
  const roleLabel = group.targetRole ? ROLE_LABEL[group.targetRole] : null;
  // On another user's profile, flag groups you'd open as a read-only preview.
  const showPublicPreview = !isOwn && !group.viewerRole;

  const body = (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={{ width: 48, height: 48, borderRadius: 24 }} />
      ) : (
        <Avatar name={group.name} size={48} />
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
          <Text variant="subtitle" numberOfLines={1} style={{ flex: 1 }}>{group.name}</Text>
          {isOwn && !group.isPublic ? <Pill label="Private" tone="muted" /> : null}
          {showPublicPreview ? <Pill label="Public preview" tone="muted" /> : null}
        </View>
        <Text variant="caption" style={{ color: t.colors.mutedForeground }} numberOfLines={1}>
          {group.memberCount} member{group.memberCount === 1 ? '' : 's'}{roleLabel ? ` · ${roleLabel}` : ''}
        </Text>
        {group.description ? (
          <Text variant="caption" numberOfLines={1}>{group.description}</Text>
        ) : null}
      </View>
      <Text variant="muted">›</Text>
    </Card>
  );

  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress}>{body}</Pressable>
  ) : (
    body
  );
}
