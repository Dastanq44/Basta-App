// Feature: groups — friend groups, invite links, create/join, archive/restore. T-023 + T-026.
// Other features (e.g. onboarding) compose with this through hooks; do not import internals.
export {
  useCreateGroup,
  useJoinGroup,
  useMyGroups,
  useMyArchivedGroups,
  useLeaveGroup,
  useArchiveGroup,
  useRestoreGroup,
  myGroupsQueryKey,
  myArchivedGroupsQueryKey,
} from './hooks';
export {
  groupNameSchema,
  inviteCodeSchema,
  createGroupInput,
  joinGroupInput,
  INVITE_CODE_LENGTH,
} from './model';
export type { CreateGroupInput, JoinGroupInput } from './model';
export { GroupCreateOrJoinForm } from './ui';
export type { GroupCreateOrJoinFormProps, GroupCreateOrJoinMode } from './ui';
