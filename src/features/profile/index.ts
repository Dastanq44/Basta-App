// Feature: profile — the redesigned profile (header + stats + world rank + compact activity +
// Submissions/Challenges/Groups tabs), shared by the own tab and the read-only /user/[id] route.
export { ActivityHeatmap, ProfileScreen } from './ui';
export type { ProfileScreenProps } from './ui';
export {
  useProfileOverview,
  useViewableUserChallenges,
  useViewableUserGroups,
  profileOverviewQueryKey,
  userChallengesQueryKey,
  userGroupsQueryKey,
} from './hooks';
export type { ProfileOverview, ProfileChallenge, ProfileGroup } from './api';
