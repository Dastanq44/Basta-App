// Feature: proofs — proof composition, the local draft + queue orchestration, server reads.
// Critical path (D-004). The submit hook writes through the offline queue, NEVER directly.
export {
  useSubmissions,
  useTodaySubmission,
  useSubmission,
  useProofSignedUrl,
  useQueueForChallenge,
  useSubmitProof,
  useChallengeStreaks,
  useRedactMySubmission,
  useMyRecentSubmissions,
  submissionsQueryKey,
  todaySubmissionQueryKey,
  submissionQueryKey,
  proofSignedUrlQueryKey,
  challengeStreaksQueryKey,
  myRecentSubmissionsQueryKey,
} from './hooks';
export { proofInput } from './model';
export type { ProofInput } from './model';
export { SyncBadge, ProofComposer } from './ui';
export type { ProofComposerSubmit } from './ui';
