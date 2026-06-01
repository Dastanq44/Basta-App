// Feature: moderation — report, block, account-deletion request. Phase 4A-2 (T-051 + T-052).
// All writes go through SECURITY DEFINER RPCs (B-006/B-008/D-009 pattern). The mobile app
// never has the service-role key; hard deletion of auth.users + Storage purge is a
// follow-up Edge Function.
export {
  useReport,
  useBlockUser,
  useUnblockUser,
  useMyBlocks,
  useBlockedUserIds,
  useRequestAccountDeletion,
  myBlocksQueryKey,
} from './hooks';
export {
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  REPORT_TARGET_TYPES,
  reportInput,
} from './model';
export type { ReportReason, ReportInput } from './model';
export { ReportSheet } from './ui';
export type { ReportSheetProps } from './ui';
