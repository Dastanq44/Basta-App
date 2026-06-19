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
  useGroupAccess,
  usePublicGroupChallenges,
  usePublicGroupSubmissions,
  groupAccessQueryKey,
  publicGroupChallengesQueryKey,
  publicGroupSubmissionsQueryKey,
} from './hooks';
export { uploadGroupAvatar, groupAvatarUrl, getGroupAccess, listPublicGroupChallenges, listPublicGroupSubmissions } from './api';
export type { GroupOverview, GroupAccess, GroupAccessMode, PublicGroupChallenge } from './api';
export {
  groupNameSchema,
  groupDescriptionSchema,
  inviteCodeSchema,
  createGroupInput,
  joinGroupInput,
  INVITE_CODE_LENGTH,
} from './model';
export type { CreateGroupInput, JoinGroupInput } from './model';
export { GroupCreateOrJoinForm, GroupAvatarPicker, PublicGroupPreview } from './ui';
export type { GroupCreateOrJoinFormProps, GroupCreateOrJoinMode, GroupAvatarPickerProps } from './ui';
