// Feature: groups — friend groups, invite links, create/join. T-023.
// Other features (e.g. onboarding) compose with this through hooks; do not import internals.
export { useCreateGroup, useJoinGroup } from './hooks';
export {
  groupNameSchema,
  inviteCodeSchema,
  createGroupInput,
  joinGroupInput,
} from './model';
export type { CreateGroupInput, JoinGroupInput } from './model';
