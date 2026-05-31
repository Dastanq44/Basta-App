import { z } from 'zod';

// Verify/reject vote shape. Mirrors the `verification_result` Postgres enum.
export const verificationResultSchema = z.enum(['approve', 'reject']);

export type { VerificationResult } from '@/entities';
