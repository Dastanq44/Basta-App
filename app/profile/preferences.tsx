import { ScrollView, View } from 'react-native';
import { Stack } from 'expo-router';
import { OrnamentDivider, Screen, Text, useTheme } from '@/shared/ui';
import { useI18n } from '@/shared/i18n';
import { LanguageSection, ThemeSection } from '@/features/preferences';

// Combined Language & theme preferences (replaces the old Appearance screen). Both sections apply
// immediately and persist on-device — no restart, no backend.
export default function PreferencesScreen() {
  const t = useTheme();
  const { t: tr } = useI18n();
  return (
    <Screen padded={false} edges={['bottom']}>
      <Stack.Screen options={{ title: tr('prefs.title') }} />
      <ScrollView contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.lg }}>
        <View style={{ gap: t.spacing.sm }}>
          <Text variant="heading">{tr('prefs.language')}</Text>
          <LanguageSection />
        </View>

        <OrnamentDivider />

        <View style={{ gap: t.spacing.sm }}>
          <Text variant="heading">{tr('prefs.theme')}</Text>
          <ThemeSection />
        </View>

        <Text variant="caption" style={{ textAlign: 'center' }}>{tr('prefs.savedOnDevice')}</Text>
      </ScrollView>
    </Screen>
  );
}
