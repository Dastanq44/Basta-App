import type { SubmissionId } from './submission';
import type { UserId } from './user';

export type VerificationResult = 'approve' | 'reject';

export type Verification = {
  id: string;
  submissionId: SubmissionId;
  verifierId: UserId;
  result: VerificationResult;
  createdAt: string;
};
