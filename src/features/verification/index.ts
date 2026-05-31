// Feature: verification — friend verification flow (T-040). Server enforces who may verify and
// owns the verified/rejected transition (D-003). Solo proofs auto-verify on submit (D-009); this
// feature handles GROUP-challenge proofs only. Push deep-link to the verify screen is T-050.
export { useVerifySubmission } from './hooks';
export { verifySubmission } from './api';
export { verificationResultSchema } from './model';
export type { VerificationResult } from './model';
