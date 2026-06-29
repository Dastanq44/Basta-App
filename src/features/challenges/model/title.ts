// Challenge titles are stored as `"<emoji> <name>"` (the create wizard prefixes the chosen emoji
// onto the name — see app/challenge/new.tsx, no separate emoji column). This splits that back into
// its emoji + display name so surfaces can show the emoji AS the challenge icon (in a tinted tile)
// and the name on its own, instead of an emoji crammed into the title next to a generic doc glyph.

/**
 * Split a stored challenge title into its leading emoji (if any) and the remaining name.
 * Hermes-safe: avoids Unicode property escapes (`\p{…}`), which aren't reliably supported.
 */
export function splitChallengeTitle(title: string | null | undefined): { emoji: string | null; name: string } {
  const trimmed = (title ?? '').trim();
  const spaceIdx = trimmed.indexOf(' ');
  if (spaceIdx > 0) {
    const head = trimmed.slice(0, spaceIdx);
    const rest = trimmed.slice(spaceIdx + 1).trim();
    if (rest.length > 0 && isEmojiToken(head)) {
      return { emoji: head, name: rest };
    }
  }
  return { emoji: null, name: trimmed };
}

// Letters/digits we recognise — Latin + Cyrillic (incl. Kazakh + Cyrillic Supplement, U+0400–U+052F).
// A token with any of these is a word, not an emoji. Written with \u escapes (no literal non-ASCII).
const WORD_CHAR = /[0-9A-Za-zЀ-ԯ]/;
// Symbol/emoji codepoints: BMP symbol+arrow+dingbat blocks (U+2190–U+2BFF), any astral surrogate
// lead (all supplementary-plane emoji), a variation selector (U+FE0F), or a keycap mark (U+20E3).
const EMOJI_CHAR = /[←-⯿\uD800-\uDBFF️⃣]/;

/**
 * Heuristic "is this token a leading emoji?" for our `"<emoji> <name>"` format: it must contain no
 * Latin/Cyrillic letters or digits (so real words like "Morning" / "Бег" aren't treated as emoji)
 * and at least one symbol/emoji codepoint. Covers the curated EMOJI_SUGGESTIONS set.
 */
function isEmojiToken(s: string): boolean {
  if (!s || s.length > 12) return false;
  if (WORD_CHAR.test(s)) return false;
  return EMOJI_CHAR.test(s);
}
