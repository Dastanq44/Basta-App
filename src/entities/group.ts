import type { UserId } from './user';

export type GroupId = string;
export type MemberRole = 'owner' | 'admin' | 'member';

export type Group = {
  id: GroupId;
  name: string;
  ownerId: UserId;
  inviteCode: string;
  /** Set when the owner archives the group; consumers exclude archived groups from active lists. */
  archivedAt?: string;
  /** Whether the group is publicly discoverable (Global). Maps to `groups.visibility`
   *  ('public' ⇒ true). Default private. */
  isPublic: boolean;
};

export type GroupMember = {
  groupId: GroupId;
  userId: UserId;
  role: MemberRole;
};
