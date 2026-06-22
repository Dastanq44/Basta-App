// Lightweight in-house i18n (skeleton) — zero extra runtime deps beyond expo-localization.
// We deliberately avoid i18n-js/intl-pluralrules for now: a flat dot-keyed dictionary + a tiny
// interpolating `t()` covers the current surface and keeps the bundle + SDK-compat risk minimal.
// Languages: kz (Kazakh), ru (Russian), en (English). English is the source of truth; missing
// keys in kz/ru fall back to en so the UI never shows a raw key.
//
// RTL: current targets are all LTR. `isRTL` is exposed and wired through so a future RTL locale
// only needs its dictionary + an `I18nManager.forceRTL` toggle — no screen rewrites.
import { createContext, createElement, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import * as Localization from 'expo-localization';

export type Lang = 'kz' | 'ru' | 'en';
export const LANGS: readonly Lang[] = ['kz', 'ru', 'en'] as const;

/** RTL flag per language — all current targets are LTR; kept for future-proofing. */
export const LANG_IS_RTL: Record<Lang, boolean> = { kz: false, ru: false, en: false };

// ── Dictionaries (flat dot-keys). en is the source of truth; kz/ru fall back to en. ──────────
const en = {
  // navigation (kept short so ru/kz don't overflow the tab bar)
  'nav.today': 'Today',
  'nav.challenges': 'Challenges',
  'nav.groups': 'Groups',
  'nav.global': 'Global',
  'nav.profile': 'Profile',

  // common actions / words
  'common.new': 'New',
  'common.save': 'Save',
  'common.saving': 'Saving…',
  'common.cancel': 'Cancel',
  'common.loading': 'Loading…',
  'common.retry': 'Retry',
  'common.join': 'Join',
  'common.joinWithCode': 'Join with code',
  'common.proof': 'Proof',
  'common.proofs': 'Proofs',
  'common.challenges': 'Challenges',
  'common.groups': 'Groups',
  'common.members': 'Members',
  'common.member': 'Member',
  'common.publicPreview': 'Public preview',
  'common.readOnly': 'Read-only',

  // today / home
  'today.greeting.morning': 'Good morning',
  'today.greeting.afternoon': 'Good afternoon',
  'today.greeting.evening': 'Good evening',
  'today.dueToday': 'Due today',
  'today.allDone': "You're all caught up",
  'today.allDoneBody': 'No proofs are due right now. Check back later or start something new.',
  'today.verifyCta': 'Proofs waiting for you to verify',
  'today.thisWeek': 'This week',
  'today.streak': 'Streak',
  'today.noChallenges': 'No active challenges',
  'today.noChallengesBody': 'Start a challenge to see your daily proofs here.',
  'today.newChallenge': 'New challenge',

  // challenges tab
  'challenges.active': 'Active',
  'challenges.finished': 'Finished',
  'challenges.empty': 'No challenges yet',
  'challenges.emptyBody': 'Create a challenge or join a group to get started.',
  'challenges.day': 'Day',
  'challenges.dayOf': 'Day {current} of {total}',

  // groups tab
  'groups.newGroup': 'New group',
  'groups.publicGroup': 'Public group',
  'groups.privateGroup': 'Private group',
  'groups.archived': 'Archived groups',
  'groups.empty': 'No groups yet',
  'groups.emptyBody': 'Create a group or join one with an invite code.',
  'groups.memberCount': '{count} members',
  'groups.memberCountOne': '1 member',

  // global feed
  'global.title': 'Global',
  'global.empty': 'No public proofs yet',
  'global.emptyBody':
    'Verified proofs from public profiles and visible challenges show up here. Make your profile and a challenge public to share yours.',

  // profile
  'profile.proofs': 'Proofs',
  'profile.challenges': 'Challenges',
  'profile.groups': 'Groups',
  'profile.activity': 'Activity · last 30 days',

  // previews
  'preview.publicTitle': 'Public preview',
  'preview.groupBody': "You're viewing this group as a public preview. Join with an invite code to post and see member-only details.",
  'preview.challengeBody': "You're viewing this challenge as a public preview. Join to take part and submit proofs.",
  'preview.joinCta': 'Join with invite code',

  // privacy copy (current simplified model — NO per-proof public/private toggle)
  'privacy.challenge.visibility': 'Challenge visibility',
  'privacy.challenge.public': 'Public challenges can appear in Global. Verified proofs follow your profile + challenge visibility.',
  'privacy.challenge.hidden': 'Hidden challenges stay out of Global. Proofs are visible to participants only.',
  'privacy.group.private': 'Private groups hide group challenge posts from Global. Members can still use the group normally.',
  'privacy.profile.public': 'Public profiles let your verified proofs appear in Global. Private keeps everything to people you share groups or challenges with.',

  // auth / onboarding
  'auth.welcome': 'Welcome to Basta',
  'auth.tagline': 'Daily proof. Real streaks. Together.',
  'auth.signIn': 'Sign in',
  'auth.signUp': 'Create account',
  'onboarding.chooseTitle': 'Join your people',
  'onboarding.createOption': 'Create a group',
  'onboarding.joinOption': 'Join with a code',
} as const;

export type I18nKey = keyof typeof en;
type Dict = Partial<Record<I18nKey, string>>;

// ru/kz seeded with the high-visibility strings; everything else falls back to en. Expand over time.
const ru: Dict = {
  'nav.today': 'Сегодня',
  'nav.challenges': 'Челленджи',
  'nav.groups': 'Группы',
  'nav.global': 'Лента',
  'nav.profile': 'Профиль',
  'common.new': 'Новый',
  'common.save': 'Сохранить',
  'common.saving': 'Сохранение…',
  'common.cancel': 'Отмена',
  'common.loading': 'Загрузка…',
  'common.retry': 'Повторить',
  'common.join': 'Вступить',
  'common.joinWithCode': 'Войти по коду',
  'common.proof': 'Пруф',
  'common.proofs': 'Пруфы',
  'common.members': 'Участники',
  'common.publicPreview': 'Публичный просмотр',
  'common.readOnly': 'Только просмотр',
  'today.dueToday': 'Сегодня',
  'today.allDone': 'Всё выполнено',
  'today.thisWeek': 'Эта неделя',
  'today.streak': 'Серия',
  'today.newChallenge': 'Новый челлендж',
  'challenges.active': 'Активные',
  'challenges.finished': 'Завершённые',
  'challenges.dayOf': 'День {current} из {total}',
  'groups.newGroup': 'Новая группа',
  'groups.publicGroup': 'Публичная группа',
  'groups.privateGroup': 'Приватная группа',
  'groups.memberCount': '{count} участников',
  'global.title': 'Лента',
  'global.empty': 'Пока нет публичных пруфов',
  'profile.proofs': 'Пруфы',
  'profile.challenges': 'Челленджи',
  'profile.groups': 'Группы',
  'preview.publicTitle': 'Публичный просмотр',
  'preview.joinCta': 'Войти по коду приглашения',
  'auth.signIn': 'Войти',
  'auth.signUp': 'Создать аккаунт',
};

const kz: Dict = {
  'nav.today': 'Бүгін',
  'nav.challenges': 'Челлендж',
  'nav.groups': 'Топтар',
  'nav.global': 'Лента',
  'nav.profile': 'Профиль',
  'common.new': 'Жаңа',
  'common.save': 'Сақтау',
  'common.saving': 'Сақталуда…',
  'common.cancel': 'Бас тарту',
  'common.loading': 'Жүктелуде…',
  'common.retry': 'Қайталау',
  'common.join': 'Қосылу',
  'common.joinWithCode': 'Код арқылы кіру',
  'common.proof': 'Дәлел',
  'common.proofs': 'Дәлелдер',
  'common.members': 'Қатысушылар',
  'common.publicPreview': 'Ашық көрініс',
  'common.readOnly': 'Тек көру',
  'today.dueToday': 'Бүгінге',
  'today.allDone': 'Бәрі орындалды',
  'today.thisWeek': 'Осы апта',
  'today.streak': 'Серия',
  'today.newChallenge': 'Жаңа челлендж',
  'challenges.active': 'Белсенді',
  'challenges.finished': 'Аяқталған',
  'challenges.dayOf': '{total}-нан {current}-күн',
  'groups.newGroup': 'Жаңа топ',
  'groups.publicGroup': 'Ашық топ',
  'groups.privateGroup': 'Жабық топ',
  'groups.memberCount': '{count} қатысушы',
  'global.title': 'Лента',
  'global.empty': 'Әзірге ашық дәлелдер жоқ',
  'profile.proofs': 'Дәлелдер',
  'profile.challenges': 'Челлендж',
  'profile.groups': 'Топтар',
  'preview.publicTitle': 'Ашық көрініс',
  'preview.joinCta': 'Шақыру коды арқылы кіру',
  'auth.signIn': 'Кіру',
  'auth.signUp': 'Аккаунт жасау',
};

const DICTS: Record<Lang, Dict> = { kz, ru, en };

/** Resolve the device language to one of our supported langs (defaults to en). */
export function getDeviceLanguage(): Lang {
  try {
    const code = Localization.getLocales()[0]?.languageCode?.toLowerCase() ?? 'en';
    if (code === 'kk' || code === 'kz') return 'kz';
    if (code === 'ru') return 'ru';
    return 'en';
  } catch {
    return 'en';
  }
}

/** Interpolate `{name}` placeholders from `vars`. */
function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/** Pure translator for a given language — used by the hook and available for non-React call sites. */
export function translate(lang: Lang, key: I18nKey, vars?: Record<string, string | number>): string {
  const value = DICTS[lang][key] ?? en[key] ?? key;
  return interpolate(value, vars);
}

// ── React binding ────────────────────────────────────────────────────────────────────────────
type I18nContextValue = {
  lang: Lang;
  isRTL: boolean;
  setLang: (lang: Lang) => void;
  t: (key: I18nKey, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(getDeviceLanguage);
  const t = useCallback(
    (key: I18nKey, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang],
  );
  const value = useMemo<I18nContextValue>(() => ({ lang, isRTL: LANG_IS_RTL[lang], setLang, t }), [lang, t]);
  return createElement(I18nContext.Provider, { value }, children);
}

/** Access `t()` + current language. Falls back to the device language outside a provider so a
 *  screen rendered in isolation (or before the provider mounts) still localizes. */
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  const lang = getDeviceLanguage();
  return { lang, isRTL: LANG_IS_RTL[lang], setLang: () => {}, t: (key, vars) => translate(lang, key, vars) };
}

/** Convenience hook returning just the translator. */
export function useT(): I18nContextValue['t'] {
  return useI18n().t;
}
