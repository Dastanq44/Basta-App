import { z } from 'zod';

export const groupNameSchema = z
  .string()
  .trim()
  .min(1, 'Group name is required')
  .max(60, 'Group name must be at most 60 characters');

// Invite codes are 4-digit numeric (e.g. "1023", "0490") since the
// 20260601 follow-up migration. Trim only — no lowercasing (digits aren't case-sensitive).
export const INVITE_CODE_LENGTH = 4;
export const inviteCodeSchema = z
  .string()
  .trim()
  .regex(new RegExp(`^\\d{${INVITE_CODE_LENGTH}}$`), `Enter the ${INVITE_CODE_LENGTH}-digit code`);

export const createGroupInput = z.object({ name: groupNameSchema });
export type CreateGroupInput = z.infer<typeof createGroupInput>;

export const joinGroupInput = z.object({ code: inviteCodeSchema });
export type JoinGroupInput = z.infer<typeof joinGroupInput>;
