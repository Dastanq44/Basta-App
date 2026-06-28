import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Stack } from 'expo-router';
import { Button, OrnamentDivider, OrnamentMedallion, Screen, Text, useTheme } from '@/shared/ui';
import { useI18n } from '@/shared/i18n';
import { LanguageSection, ThemeSection, usePreferencesGate } from '@/features/preferences';

type Step = 'language' | 'theme';

// First-launch personalization — one question per screen: Language → Theme → done. Choices apply
// live (the theme actually changes as you tap) and persist; "Get started" marks completion and the
// root gate advances to the normal auth/onboarding flow. Shown once per install.
export default function PreferencesFlowScreen() {
  const t = useTheme();
  const { t: tr } = useI18n();
  const gate = usePreferencesGate();
  const [step, setStep] = useState<Step>('language');

  const isLanguage = step === 'language';

  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.lg, flexGrow: 1 }}>
        {/* Light branded hero — one medallion + ornament band, no wallpaper. */}
        <View style={{ alignItems: 'center', gap: t.spacing.sm, paddingTop: t.spacing.md }}>
          <OrnamentMedallion size={64} />
          <Text variant="label" style={{ color: t.colors.primary }}>{tr('prefs.welcomeKicker')}</Text>
          <Text variant="title" style={{ textAlign: 'center' }}>
            {isLanguage ? tr('prefs.languageTitle') : tr('prefs.themeTitle')}
          </Text>
          <Text variant="muted" style={{ textAlign: 'center' }}>
            {isLanguage ? tr('prefs.languageSubtitle') : tr('prefs.themeSubtitle')}
          </Text>
          <OrnamentDivider style={{ alignSelf: 'stretch', marginTop: t.spacing.xs }} />
        </View>

        {isLanguage ? <LanguageSection /> : <ThemeSection />}
      </ScrollView>

      {/* Sticky action bar. */}
      <View style={{ flexDirection: 'row', gap: t.spacing.md, padding: t.spacing.lg, paddingTop: t.spacing.sm }}>
        {!isLanguage ? (
          <View style={{ flex: 1 }}>
            <Button label={tr('common.back')} variant="secondary" onPress={() => setStep('language')} />
          </View>
        ) : null}
        <View style={{ flex: isLanguage ? 1 : 2 }}>
          <Button
            label={isLanguage ? tr('common.continue') : tr('prefs.getStarted')}
            onPress={() => (isLanguage ? setStep('theme') : gate.markCompleted())}
          />
        </View>
      </View>
    </Screen>
  );
}
