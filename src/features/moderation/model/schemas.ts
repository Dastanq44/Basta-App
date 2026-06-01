import { z } from 'zod';
import type { ReportTargetType } from '@/entities';

/** Canonical reason list — Phase 4A-2 MVP, keep small. */
export const REPORT_REASONS = [
  'spam',
  'harassment',
  'hate_speech',
  'self_harm',
  'sexual_content',
  'violence',
  'inappropriate_content',
  'impersonation',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_TARGET_TYPES = ['submission', 'comment', 'user', 'group', 'challenge'] as const;

export const reportInput = z.object({
  targetType: z.enum(REPORT_TARGET_TYPES) satisfies z.ZodType<ReportTargetType>,
  targetId: z.string().uuid('Target id must be a UUID'),
  reason: z.enum(REPORT_REASONS, {
    errorMap: () => ({ message: 'Pick a reason' }),
  }),
  details: z
    .string()
    .trim()
    .max(1000, 'At most 1000 characters')
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});
export type ReportInput = z.infer<typeof reportInput>;

/** Human-readable label per reason. UI uses these on the picker. */
export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: 'Spam',
  harassment: 'Harassment or bullying',
  hate_speech: 'Hate speech',
  self_harm: 'Self-harm',
  sexual_content: 'Sexual content',
  violence: 'Violence',
  inappropriate_content: 'Inappropriate content',
  impersonation: 'Impersonation',
  other: 'Other',
};
