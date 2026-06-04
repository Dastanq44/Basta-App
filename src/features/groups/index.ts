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
  useUpdateGroup,
  useGroupOverview,
  useUpdateGroupMeta,
  groupOverviewQueryKey,
  useTransferGroupLeadership,
  myGroupsQueryKey,
  myArchivedGroupsQueryKey,
} from './hooks';
export { uploadGroupAvatar, groupAvatarUrl } from './api';
export type { GroupOverview } from './api';
export {
  groupNameSchema,
  groupDescriptionSchema,
  inviteCodeSchema,
  createGroupInput,
  joinGroupInput,
  INVITE_CODE_LENGTH,
} from './model';
export type { CreateGroupInput, JoinGroupInput } from './model';
export { GroupCreateOrJoinForm, GroupAvatarPicker } from './ui';
export type { GroupCreateOrJoinFormProps, GroupCreateOrJoinMode, GroupAvatarPickerProps } from './ui';
