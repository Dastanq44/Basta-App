import { z } from 'zod';

export const groupNameSchema = z
  .string()
  .trim()
  .min(1, 'Group name is required')
  .max(60, 'Group name must be at most 60 characters');

// Invite codes are 12 characters from [A-Za-z0-9] (62^12 keyspace) since the 20260604
// security migration. They are CASE-SENSITIVE — trim only, never upper/lower-case them,
// otherwise the exact server-side comparison (`invite_code = p_code`) won't match.
export const INVITE_CODE_LENGTH = 12;
export const inviteCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9]{12}$/, `Enter the ${INVITE_CODE_LENGTH}-character invite code`);

// Optional group description (Main info). Trim; empty string is treated as "no description".
export const groupDescriptionSchema = z
  .string()
  .trim()
  .max(280, 'Description must be at most 280 characters');

export const createGroupInput = z.object({ name: groupNameSchema });
export type CreateGroupInput = z.infer<typeof createGroupInput>;

export const joinGroupInput = z.object({ code: inviteCodeSchema });
export type JoinGroupInput = z.infer<typeof joinGroupInput>;
