// Emoji dataset for the custom in-app picker (replaces rn-emoji-keyboard). The JSON is the
// standard grouped emoji list (category → { emoji, name, keywords }); we own the UI, so the
// category highlight / search / layout are fully under our control.
import emojisJson from './emojis.json';

export type EmojiEntry = { emoji: string; name: string; keywords: string[] };
export type EmojiCategory = { key: string; label: string; icon: string; emojis: EmojiEntry[] };

type RawCategory = {
  title: string;
  data: { emoji: string; name: string; keywords?: string[] }[];
};

// Tab label + a representative emoji icon per category (full-color glyph — the active state is
// shown by the sliding highlight behind it, so there's no monochrome icon-color to snap).
const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  smileys_emotion: { label: 'Smileys', icon: '😀' },
  people_body: { label: 'People', icon: '🧑' },
  animals_nature: { label: 'Animals', icon: '🐶' },
  food_drink: { label: 'Food', icon: '🍔' },
  travel_places: { label: 'Travel', icon: '✈️' },
  activities: { label: 'Activities', icon: '⚽' },
  objects: { label: 'Objects', icon: '💡' },
  symbols: { label: 'Symbols', icon: '❤️' },
  flags: { label: 'Flags', icon: '🏳️' },
};

export const EMOJI_CATEGORIES: EmojiCategory[] = (emojisJson as RawCategory[]).map((c) => ({
  key: c.title,
  label: CATEGORY_META[c.title]?.label ?? c.title,
  icon: CATEGORY_META[c.title]?.icon ?? '⭐',
  emojis: c.data.map((e) => ({ emoji: e.emoji, name: e.name, keywords: e.keywords ?? [] })),
}));

const ALL_EMOJIS: EmojiEntry[] = EMOJI_CATEGORIES.flatMap((c) => c.emojis);

/** Name/keyword substring search across all emojis. Capped so the results grid stays light. */
export function searchEmojis(query: string, limit = 180): EmojiEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out: EmojiEntry[] = [];
  for (const e of ALL_EMOJIS) {
    if (e.name.toLowerCase().includes(q) || e.keywords.some((k) => k.toLowerCase().includes(q))) {
      out.push(e);
      if (out.length >= limit) break;
    }
  }
  return out;
}
