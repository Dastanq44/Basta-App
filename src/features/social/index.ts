// Feature: social — reactions + short comments on submissions (T-041). Writes via RPC
// (participant-gated); reads are RLS-limited to challenge participants.
export { ReactionBar, CommentsSection, EmojiPickerSheet } from './ui';
export { REACTION_EMOJIS } from './model';
export type { ReactionEmoji, ReactionSummary } from './model';
