import type { ChallengeCategory } from './schemas';

/** Curated emoji suggestions per challenge category — shown first in the icon step so the user
 *  rarely needs to open the full picker. Diverse, with minimal cross-category duplication. */
export const EMOJI_SUGGESTIONS: Record<ChallengeCategory, string[]> = {
  fitness: ['💪', '🏃', '🏋️', '🔥', '🚴', '🥗', '💧', '🧠'],
  reading: ['📚', '📖', '☕', '✍️', '🧠', '🗂️'],
  meditation: ['🧘', '🌿', '🌙', '☀️', '🫶', '💨'],
  creativity: ['🎨', '🎸', '🎭', '📷', '✍️', '🎬'],
  study: ['📝', '💻', '📘', '🧠', '📚', '⏳'],
  language: ['🗣️', '🌍', '🔤', '📚', '🎧'],
  work: ['💼', '💻', '📈', '☕', '✅'],
  other: ['⭐', '🎯', '🌱', '🔥', '🚀', '💡'],
};

/** Maps a challenge category to the most relevant emoji-picker section key (for the initial jump
 *  when "Browse all emoji" opens). Keys match EMOJI_CATEGORIES in the social feature. */
export const CATEGORY_EMOJI_SECTION: Record<ChallengeCategory, string> = {
  fitness: 'activities',
  reading: 'objects',
  meditation: 'animals_nature',
  creativity: 'activities',
  study: 'objects',
  language: 'people_body',
  work: 'objects',
  other: 'smileys_emotion',
};
