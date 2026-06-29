import { Pressable, View } from 'react-native';
import { Avatar, Card, Icon, Text, useTheme } from '@/shared/ui';
import { formatMemberRole, useI18n } from '@/shared/i18n';
import { groupAvatarUrl } from '@/features/groups';
import type { ProfileGroup } from '../api';
import { Pill } from './Pill';

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
  const { t: tr, tn, lang } = useI18n();
  const avatarUrl = groupAvatarUrl(group.avatarPath);
  const roleLabel = group.targetRole ? formatMemberRole(lang, group.targetRole) : null;

  const body = (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
      <Avatar name={group.name} uri={avatarUrl} size={48} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
          <Text variant="subtitle" numberOfLines={1} style={{ flex: 1 }}>{group.name}</Text>
          {isOwn && !group.isPublic ? <Pill label={tr('pill.private')} tone="muted" /> : null}
        </View>
        <Text variant="caption" style={{ color: t.colors.mutedForeground }} numberOfLines={1}>
          {tn('members', group.memberCount)}{roleLabel ? ` · ${roleLabel}` : ''}
        </Text>
        {group.description ? (
          <Text variant="caption" numberOfLines={1}>{group.description}</Text>
        ) : null}
      </View>
      <Icon name="chevron" size={16} color={t.colors.mutedForeground} />
    </Card>
  );

  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress}>{body}</Pressable>
  ) : (
    body
  );
}
