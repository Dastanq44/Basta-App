// Emoji dataset for the custom in-app picker (replaces rn-emoji-keyboard). The JSON is the
// standard grouped emoji list (category → { emoji, name, keywords }); we own the UI, so the
// category highlight / search / layout are fully under our control. Category labels are LOCALIZED
// at render time (via `labelKey` → i18n), not baked into the data.
import type { I18nKey } from '@/shared/i18n';
import emojisJson from './emojis.json';

export type EmojiEntry = { emoji: string; name: string; keywords: string[] };
export type EmojiCategory = { key: string; labelKey: I18nKey; icon: string; emojis: EmojiEntry[] };

type RawCategory = {
  title: string;
  data: { emoji: string; name: string; keywords?: string[] }[];
};

// i18n label key + a representative emoji icon per category (full-color glyph). Ordered to match
// the common keyboard / Emojipedia sequence (Smileys → People → Animals → Food → Activities →
// Travel → Objects → Symbols → Flags) — note Activities precedes Travel, the standard order.
const CATEGORY_META: Record<string, { labelKey: I18nKey; icon: string }> = {
  smileys_emotion: { labelKey: 'emoji.cat.smileys', icon: '😀' },
  people_body: { labelKey: 'emoji.cat.people', icon: '🧑' },
  animals_nature: { labelKey: 'emoji.cat.animals', icon: '🐶' },
  food_drink: { labelKey: 'emoji.cat.food', icon: '🍔' },
  activities: { labelKey: 'emoji.cat.activities', icon: '⚽' },
  travel_places: { labelKey: 'emoji.cat.travel', icon: '✈️' },
  objects: { labelKey: 'emoji.cat.objects', icon: '💡' },
  symbols: { labelKey: 'emoji.cat.symbols', icon: '❤️' },
  flags: { labelKey: 'emoji.cat.flags', icon: '🏳️' },
};

const CATEGORY_ORDER = Object.keys(CATEGORY_META);

export const EMOJI_CATEGORIES: EmojiCategory[] = (emojisJson as RawCategory[])
  .filter((c) => CATEGORY_META[c.title]) // keep only known categories
  .sort((a, b) => CATEGORY_ORDER.indexOf(a.title) - CATEGORY_ORDER.indexOf(b.title))
  .map((c) => ({
    key: c.title,
    labelKey: CATEGORY_META[c.title]!.labelKey,
    icon: CATEGORY_META[c.title]!.icon,
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
