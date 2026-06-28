import { View } from 'react-native';
import { LanguageOptionCard } from '@/shared/ui';
import { LANG_NATIVE_NAME, LANGS, useI18n, type Lang } from '@/shared/i18n';

const ENGLISH_NAME: Record<Lang, string> = { 'en-US': 'English (US)', 'kk-KZ': 'Kazakh', 'ru-RU': 'Russian' };

/** Language chooser — picking applies immediately and persists (via useI18n.setLanguage). */
export function LanguageSection() {
  const { lang, setLanguage } = useI18n();
  return (
    <View style={{ gap: 10 }}>
      {LANGS.map((l) => (
        <LanguageOptionCard
          key={l}
          title={LANG_NATIVE_NAME[l]}
          subtitle={l === 'en-US' ? undefined : ENGLISH_NAME[l]}
          selected={lang === l}
          onPress={() => setLanguage(l)}
        />
      ))}
    </View>
  );
}
