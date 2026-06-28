// Lightweight in-house i18n — zero extra runtime deps beyond expo-localization. A flat dot-keyed
// dictionary + a tiny interpolating t() + an Intl.PluralRules-backed tn() for counts (important for
// Russian). Languages: en-US (source of truth), kk-KZ, ru-RU. Missing kk/ru keys fall back to en.
//
// Persistence: the selected language is stored via appPreferences (SecureStore) and loaded on mount;
// device locale is the fallback for a brand-new install.
//
// RTL: current targets are all LTR. `isRTL` is exposed so a future RTL locale needs only a dict + an
// I18nManager.forceRTL toggle — no screen rewrites.
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as Localization from 'expo-localization';
import {
  DEFAULT_LANGUAGE,
  getStoredLanguage,
  normalizeLanguage,
  storeLanguage,
  type AppLanguage,
} from '@/shared/lib/appPreferences';

export type Lang = AppLanguage;
export const LANGS: readonly Lang[] = ['en-US', 'kk-KZ', 'ru-RU'] as const;
export const LANG_IS_RTL: Record<Lang, boolean> = { 'en-US': false, 'kk-KZ': false, 'ru-RU': false };

/** Native display name per language (shown in the picker — always in its own language). */
export const LANG_NATIVE_NAME: Record<Lang, string> = { 'en-US': 'English (US)', 'kk-KZ': 'Қазақша', 'ru-RU': 'Русский' };

// ── Dictionaries (flat dot-keys). en-US is the source of truth; kk/ru fall back to en. ───────────
const en = {
  // navigation
  'nav.today': 'Today',
  'nav.challenges': 'Challenges',
  'nav.groups': 'Groups',
  'nav.global': 'Global',
  'nav.profile': 'Profile',

  // common
  'common.new': 'New',
  'common.save': 'Save',
  'common.saving': 'Saving…',
  'common.cancel': 'Cancel',
  'common.back': 'Back',
  'common.continue': 'Continue',
  'common.done': 'Done',
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
  'today.currentStreak': 'Current streak',
  'today.doneToday': 'Done today',
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

  // member count (plural — tn)
  'members.one': '{count} member',
  'members.other': '{count} members',

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

  // privacy copy
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

  // settings (profile sheet + preferences screen)
  'settings.editProfile': 'Edit profile',
  'settings.languageTheme': 'Language & theme',
  'settings.blockedUsers': 'Blocked users',
  'settings.requestDeletion': 'Request account deletion',
  'settings.signOut': 'Sign out',

  // preferences screen
  'prefs.title': 'Language & theme',
  'prefs.language': 'Language',
  'prefs.theme': 'Theme',
  'prefs.savedOnDevice': 'Saved on this device only.',

  // first-launch personalization
  'prefs.welcomeKicker': 'Welcome to Basta',
  'prefs.languageTitle': 'Choose your language',
  'prefs.languageSubtitle': 'You can change this later in settings.',
  'prefs.themeTitle': 'Choose your theme',
  'prefs.themeSubtitle': 'You can change this later in settings.',
  'prefs.getStarted': 'Get started',

  // theme display names
  'theme.whiteBlue': 'White + Blue',
  'theme.darkBlue': 'Dark + Blue',
  'theme.steppeSky': 'Steppe Sky',
  'theme.sageGrowth': 'Sage Growth',
  'theme.whiteBlue.desc': 'Clean & clear — the everyday look',
  'theme.darkBlue.desc': 'Focused evening mode',
  'theme.steppeSky.desc': 'Kazakh style — cream, sky & gold',
  'theme.sageGrowth.desc': 'Calm green, growth-minded',

  // challenge creation wizard
  'wizard.type.title': 'Solo or group?',
  'wizard.type.solo': 'Solo',
  'wizard.type.group': 'Group',
  'wizard.group.title': 'Which group?',
  'wizard.category.title': 'Pick a category',
  'wizard.name.title': 'Name it',
  'wizard.icon.title': 'Pick an icon',
  'wizard.icon.browseAll': 'Browse all emoji',
  'wizard.icon.suggested': 'Suggested',
  'wizard.start.title': 'Start date',
  'wizard.end.title': 'End date',
  'wizard.desc.title': 'Proof requirement',
  'wizard.create': 'Create',
  'wizard.creating': 'Creating…',
  'wizard.next': 'Next',

  // challenge categories
  'category.fitness': 'Fitness',
  'category.reading': 'Reading',
  'category.meditation': 'Meditation',
  'category.creativity': 'Creativity',
  'category.study': 'Study',
  'category.language': 'Language',
  'category.work': 'Work',
  'category.other': 'Other',

  // emoji picker
  'emoji.search': 'Search emoji',
  'emoji.clearSearch': 'Clear search',
  'emoji.noResults': 'No emoji match “{query}”.',
  'emoji.cat.smileys': 'Smileys & Emotion',
  'emoji.cat.people': 'People & Body',
  'emoji.cat.animals': 'Animals & Nature',
  'emoji.cat.food': 'Food & Drink',
  'emoji.cat.activities': 'Activities',
  'emoji.cat.travel': 'Travel & Places',
  'emoji.cat.objects': 'Objects',
  'emoji.cat.symbols': 'Symbols',
  'emoji.cat.flags': 'Flags',
} as const;

export type I18nKey = keyof typeof en;
type Dict = Partial<Record<string, string>>;

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
  'common.back': 'Назад',
  'common.continue': 'Продолжить',
  'common.done': 'Готово',
  'common.loading': 'Загрузка…',
  'common.retry': 'Повторить',
  'common.join': 'Вступить',
  'common.joinWithCode': 'Войти по коду',
  'common.proof': 'Пруф',
  'common.proofs': 'Пруфы',
  'common.challenges': 'Челленджи',
  'common.groups': 'Группы',
  'common.members': 'Участники',
  'common.member': 'Участник',
  'common.publicPreview': 'Публичный просмотр',
  'common.readOnly': 'Только просмотр',
  'today.greeting.morning': 'Доброе утро',
  'today.greeting.afternoon': 'Добрый день',
  'today.greeting.evening': 'Добрый вечер',
  'today.dueToday': 'Сегодня',
  'today.allDone': 'Всё выполнено',
  'today.allDoneBody': 'Сейчас нет пруфов к сдаче. Загляните позже или начните что-то новое.',
  'today.thisWeek': 'Эта неделя',
  'today.streak': 'Серия',
  'today.currentStreak': 'Текущая серия',
  'today.doneToday': 'Сегодня',
  'today.noChallenges': 'Нет активных челленджей',
  'today.noChallengesBody': 'Начните челлендж, чтобы видеть здесь ежедневные пруфы.',
  'today.newChallenge': 'Новый челлендж',
  'challenges.active': 'Активные',
  'challenges.finished': 'Завершённые',
  'challenges.empty': 'Пока нет челленджей',
  'challenges.emptyBody': 'Создайте челлендж или вступите в группу, чтобы начать.',
  'challenges.day': 'День',
  'challenges.dayOf': 'День {current} из {total}',
  'groups.newGroup': 'Новая группа',
  'groups.publicGroup': 'Публичная группа',
  'groups.privateGroup': 'Приватная группа',
  'groups.archived': 'Архив групп',
  'groups.empty': 'Пока нет групп',
  'groups.emptyBody': 'Создайте группу или вступите по коду приглашения.',
  'groups.memberCount': '{count} участников',
  'groups.memberCountOne': '1 участник',
  'members.one': '{count} участник',
  'members.few': '{count} участника',
  'members.many': '{count} участников',
  'members.other': '{count} участника',
  'global.title': 'Лента',
  'global.empty': 'Пока нет публичных пруфов',
  'global.emptyBody': 'Здесь появляются проверенные пруфы из публичных профилей и видимых челленджей. Сделайте профиль и челлендж публичными, чтобы делиться своими.',
  'profile.proofs': 'Пруфы',
  'profile.challenges': 'Челленджи',
  'profile.groups': 'Группы',
  'profile.activity': 'Активность · 30 дней',
  'preview.publicTitle': 'Публичный просмотр',
  'preview.groupBody': 'Вы смотрите группу как публичный просмотр. Войдите по коду приглашения, чтобы публиковать и видеть детали для участников.',
  'preview.challengeBody': 'Вы смотрите челлендж как публичный просмотр. Вступите, чтобы участвовать и сдавать пруфы.',
  'preview.joinCta': 'Войти по коду приглашения',
  'auth.welcome': 'Добро пожаловать в Basta',
  'auth.tagline': 'Ежедневный пруф. Реальные серии. Вместе.',
  'auth.signIn': 'Войти',
  'auth.signUp': 'Создать аккаунт',
  'settings.editProfile': 'Изменить профиль',
  'settings.languageTheme': 'Язык и тема',
  'settings.blockedUsers': 'Заблокированные',
  'settings.requestDeletion': 'Запросить удаление аккаунта',
  'settings.signOut': 'Выйти',
  'prefs.title': 'Язык и тема',
  'prefs.language': 'Язык',
  'prefs.theme': 'Тема',
  'prefs.savedOnDevice': 'Сохраняется только на этом устройстве.',
  'prefs.welcomeKicker': 'Добро пожаловать в Basta',
  'prefs.languageTitle': 'Выберите язык',
  'prefs.languageSubtitle': 'Это можно изменить позже в настройках.',
  'prefs.themeTitle': 'Выберите тему',
  'prefs.themeSubtitle': 'Это можно изменить позже в настройках.',
  'prefs.getStarted': 'Начать',
  'theme.whiteBlue': 'Белый + синий',
  'theme.darkBlue': 'Тёмный + синий',
  'theme.steppeSky': 'Степное небо',
  'theme.sageGrowth': 'Зелёный рост',
  'theme.whiteBlue.desc': 'Чисто и ясно — на каждый день',
  'theme.darkBlue.desc': 'Сфокусированный вечерний режим',
  'theme.steppeSky.desc': 'Казахский стиль — крем, небо и золото',
  'theme.sageGrowth.desc': 'Спокойный зелёный, про рост',
  'wizard.type.title': 'Соло или группа?',
  'wizard.type.solo': 'Соло',
  'wizard.type.group': 'Группа',
  'wizard.group.title': 'Какая группа?',
  'wizard.category.title': 'Выберите категорию',
  'wizard.name.title': 'Название',
  'wizard.icon.title': 'Выберите иконку',
  'wizard.icon.browseAll': 'Все эмодзи',
  'wizard.icon.suggested': 'Рекомендуемые',
  'wizard.start.title': 'Дата начала',
  'wizard.end.title': 'Дата окончания',
  'wizard.desc.title': 'Требование к пруфу',
  'wizard.create': 'Создать',
  'wizard.creating': 'Создание…',
  'wizard.next': 'Далее',
  'category.fitness': 'Фитнес',
  'category.reading': 'Чтение',
  'category.meditation': 'Медитация',
  'category.creativity': 'Творчество',
  'category.study': 'Учёба',
  'category.language': 'Языки',
  'category.work': 'Работа',
  'category.other': 'Другое',
  'emoji.search': 'Поиск эмодзи',
  'emoji.clearSearch': 'Очистить',
  'emoji.noResults': 'Нет эмодзи по запросу «{query}».',
  'emoji.cat.smileys': 'Смайлы и эмоции',
  'emoji.cat.people': 'Люди и тело',
  'emoji.cat.animals': 'Животные и природа',
  'emoji.cat.food': 'Еда и напитки',
  'emoji.cat.activities': 'Активности',
  'emoji.cat.travel': 'Путешествия и места',
  'emoji.cat.objects': 'Объекты',
  'emoji.cat.symbols': 'Символы',
  'emoji.cat.flags': 'Флаги',
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
  'common.back': 'Артқа',
  'common.continue': 'Жалғастыру',
  'common.done': 'Дайын',
  'common.loading': 'Жүктелуде…',
  'common.retry': 'Қайталау',
  'common.join': 'Қосылу',
  'common.joinWithCode': 'Код арқылы кіру',
  'common.proof': 'Дәлел',
  'common.proofs': 'Дәлелдер',
  'common.challenges': 'Челлендж',
  'common.groups': 'Топтар',
  'common.members': 'Қатысушылар',
  'common.member': 'Қатысушы',
  'common.publicPreview': 'Ашық көрініс',
  'common.readOnly': 'Тек көру',
  'today.greeting.morning': 'Қайырлы таң',
  'today.greeting.afternoon': 'Қайырлы күн',
  'today.greeting.evening': 'Қайырлы кеш',
  'today.dueToday': 'Бүгінге',
  'today.allDone': 'Бәрі орындалды',
  'today.allDoneBody': 'Қазір тапсыратын дәлел жоқ. Кейінірек кіріңіз немесе жаңасын бастаңыз.',
  'today.thisWeek': 'Осы апта',
  'today.streak': 'Серия',
  'today.currentStreak': 'Ағымдағы серия',
  'today.doneToday': 'Бүгін',
  'today.noChallenges': 'Белсенді челлендж жоқ',
  'today.noChallengesBody': 'Күнделікті дәлелдерді осы жерден көру үшін челлендж бастаңыз.',
  'today.newChallenge': 'Жаңа челлендж',
  'challenges.active': 'Белсенді',
  'challenges.finished': 'Аяқталған',
  'challenges.empty': 'Әзірге челлендж жоқ',
  'challenges.emptyBody': 'Бастау үшін челлендж құрыңыз немесе топқа қосылыңыз.',
  'challenges.day': 'Күн',
  'challenges.dayOf': '{total}-нан {current}-күн',
  'groups.newGroup': 'Жаңа топ',
  'groups.publicGroup': 'Ашық топ',
  'groups.privateGroup': 'Жабық топ',
  'groups.archived': 'Топтар мұрағаты',
  'groups.empty': 'Әзірге топ жоқ',
  'groups.emptyBody': 'Топ құрыңыз немесе шақыру коды арқылы қосылыңыз.',
  'groups.memberCount': '{count} қатысушы',
  'groups.memberCountOne': '1 қатысушы',
  'members.one': '{count} қатысушы',
  'members.other': '{count} қатысушы',
  'global.title': 'Лента',
  'global.empty': 'Әзірге ашық дәлелдер жоқ',
  'global.emptyBody': 'Мұнда ашық профильдер мен көрінетін челлендждердің тексерілген дәлелдері шығады. Өзіңіздікімен бөлісу үшін профиль мен челленджді ашық етіңіз.',
  'profile.proofs': 'Дәлелдер',
  'profile.challenges': 'Челлендж',
  'profile.groups': 'Топтар',
  'profile.activity': 'Белсенділік · 30 күн',
  'preview.publicTitle': 'Ашық көрініс',
  'preview.groupBody': 'Сіз бұл топты ашық көрініс ретінде қарап тұрсыз. Жариялау және мүшелерге арналған мәліметтерді көру үшін шақыру коды арқылы кіріңіз.',
  'preview.challengeBody': 'Сіз бұл челленджді ашық көрініс ретінде қарап тұрсыз. Қатысып, дәлел тапсыру үшін қосылыңыз.',
  'preview.joinCta': 'Шақыру коды арқылы кіру',
  'auth.welcome': 'Basta-ға қош келдіңіз',
  'auth.tagline': 'Күнделікті дәлел. Нақты серия. Бірге.',
  'auth.signIn': 'Кіру',
  'auth.signUp': 'Аккаунт жасау',
  'settings.editProfile': 'Профильді өзгерту',
  'settings.languageTheme': 'Тіл және тема',
  'settings.blockedUsers': 'Бұғатталғандар',
  'settings.requestDeletion': 'Аккаунтты жоюды сұрау',
  'settings.signOut': 'Шығу',
  'prefs.title': 'Тіл және тема',
  'prefs.language': 'Тіл',
  'prefs.theme': 'Тема',
  'prefs.savedOnDevice': 'Тек осы құрылғыда сақталады.',
  'prefs.welcomeKicker': 'Basta-ға қош келдіңіз',
  'prefs.languageTitle': 'Тіліңізді таңдаңыз',
  'prefs.languageSubtitle': 'Мұны кейін баптаулардан өзгертуге болады.',
  'prefs.themeTitle': 'Теманы таңдаңыз',
  'prefs.themeSubtitle': 'Мұны кейін баптаулардан өзгертуге болады.',
  'prefs.getStarted': 'Бастау',
  'theme.whiteBlue': 'Ақ + көк',
  'theme.darkBlue': 'Қара + көк',
  'theme.steppeSky': 'Дала аспаны',
  'theme.sageGrowth': 'Жасыл өсу',
  'theme.whiteBlue.desc': 'Таза әрі айқын — күнделікті',
  'theme.darkBlue.desc': 'Шоғырланған кешкі режим',
  'theme.steppeSky.desc': 'Қазақ стилі — крем, аспан, алтын',
  'theme.sageGrowth.desc': 'Тыныш жасыл, өсу туралы',
  'wizard.type.title': 'Жеке ме, топ па?',
  'wizard.type.solo': 'Жеке',
  'wizard.type.group': 'Топ',
  'wizard.group.title': 'Қай топ?',
  'wizard.category.title': 'Санатты таңдаңыз',
  'wizard.name.title': 'Атауы',
  'wizard.icon.title': 'Иконка таңдаңыз',
  'wizard.icon.browseAll': 'Барлық эмодзи',
  'wizard.icon.suggested': 'Ұсынылған',
  'wizard.start.title': 'Басталу күні',
  'wizard.end.title': 'Аяқталу күні',
  'wizard.desc.title': 'Дәлел талабы',
  'wizard.create': 'Құру',
  'wizard.creating': 'Құрылуда…',
  'wizard.next': 'Келесі',
  'category.fitness': 'Фитнес',
  'category.reading': 'Оқу',
  'category.meditation': 'Медитация',
  'category.creativity': 'Шығармашылық',
  'category.study': 'Оқу-білім',
  'category.language': 'Тілдер',
  'category.work': 'Жұмыс',
  'category.other': 'Басқа',
  'emoji.search': 'Эмодзи іздеу',
  'emoji.clearSearch': 'Тазалау',
  'emoji.noResults': '«{query}» бойынша эмодзи жоқ.',
  'emoji.cat.smileys': 'Смайлдар',
  'emoji.cat.people': 'Адамдар',
  'emoji.cat.animals': 'Жануарлар мен табиғат',
  'emoji.cat.food': 'Тамақ пен сусын',
  'emoji.cat.activities': 'Әрекеттер',
  'emoji.cat.travel': 'Саяхат пен орындар',
  'emoji.cat.objects': 'Заттар',
  'emoji.cat.symbols': 'Таңбалар',
  'emoji.cat.flags': 'Тулар',
};

const DICTS: Record<Lang, Dict> = { 'kk-KZ': kz, 'ru-RU': ru, 'en-US': en as Dict };

/** Resolve the device language to a supported AppLanguage (defaults to en-US). */
export function getDeviceLanguage(): Lang {
  try {
    const loc = Localization.getLocales()[0];
    return normalizeLanguage(loc?.languageTag ?? loc?.languageCode) ?? DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

function lookup(lang: Lang, key: string): string {
  return DICTS[lang][key] ?? (en as Dict)[key] ?? key;
}

/** Pure translator for a given language — also usable at non-React call sites. */
export function translate(lang: Lang, key: I18nKey, vars?: Record<string, string | number>): string {
  return interpolate(lookup(lang, key), vars);
}

/** Plural category for `count` in `lang` (cardinal). Falls back to one/other if Intl is unavailable. */
function pluralCategory(lang: Lang, count: number): string {
  try {
    return new Intl.PluralRules(lang).select(count);
  } catch {
    return count === 1 ? 'one' : 'other';
  }
}

/** Pluralized translate: resolves `${keyBase}.${category}` (falls back to `.other`). `count` is also
 *  passed as an interpolation var so the dict can render `{count}`. */
export function translateCount(lang: Lang, keyBase: string, count: number, vars?: Record<string, string | number>): string {
  const cat = pluralCategory(lang, count);
  const merged = { count, ...(vars ?? {}) };
  const exact = DICTS[lang][`${keyBase}.${cat}`] ?? (en as Dict)[`${keyBase}.${cat}`];
  const other = DICTS[lang][`${keyBase}.other`] ?? (en as Dict)[`${keyBase}.other`];
  return interpolate(exact ?? other ?? keyBase, merged);
}

// ── React binding ────────────────────────────────────────────────────────────────────────────
type I18nContextValue = {
  lang: Lang;
  isRTL: boolean;
  /** Change + persist the active language (applies immediately, no restart). */
  setLanguage: (lang: Lang) => void;
  t: (key: I18nKey, vars?: Record<string, string | number>) => string;
  /** Pluralized translate for counts (Intl.PluralRules). */
  tn: (keyBase: string, count: number, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getDeviceLanguage);

  // Load the persisted choice once on mount (overrides the device fallback if present).
  useEffect(() => {
    let active = true;
    getStoredLanguage().then((stored) => {
      if (active && stored) setLangState(stored);
    });
    return () => {
      active = false;
    };
  }, []);

  const setLanguage = useCallback((next: Lang) => {
    setLangState(next);
    void storeLanguage(next);
  }, []);

  const t = useCallback((key: I18nKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
  const tn = useCallback(
    (keyBase: string, count: number, vars?: Record<string, string | number>) => translateCount(lang, keyBase, count, vars),
    [lang],
  );
  const value = useMemo<I18nContextValue>(
    () => ({ lang, isRTL: LANG_IS_RTL[lang], setLanguage, t, tn }),
    [lang, setLanguage, t, tn],
  );
  return createElement(I18nContext.Provider, { value }, children);
}

/** Access `t()` / `tn()` + current language. Falls back to device language outside a provider. */
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  const lang = getDeviceLanguage();
  return {
    lang,
    isRTL: LANG_IS_RTL[lang],
    setLanguage: () => {},
    t: (key, vars) => translate(lang, key, vars),
    tn: (keyBase, count, vars) => translateCount(lang, keyBase, count, vars),
  };
}

/** Convenience hook returning just the translator. */
export function useT(): I18nContextValue['t'] {
  return useI18n().t;
}
