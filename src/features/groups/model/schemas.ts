import { z } from 'zod';

export const groupNameSchema = z
  .string()
  .trim()
  .min(1, 'Group name is required')
  .max(60, 'Group name must be at most 60 characters');

// Invite codes are 6 bytes hex (12 chars) on creation, but we accept any 4–32 length to be
// forgiving of future formats. Trim + lowercase to match how `groups.invite_code` is stored.
export const inviteCodeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(4, 'Invite code looks too short')
  .max(32, 'Invite code looks too long');

export const createGroupInput = z.object({ name: groupNameSchema });
export type CreateGroupInput = z.infer<typeof createGroupInput>;

export const joinGroupInput = z.object({ code: inviteCodeSchema });
export type JoinGroupInput = z.infer<typeof joinGroupInput>;
