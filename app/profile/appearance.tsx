import { ScrollView, View } from 'react-native';
import { Stack } from 'expo-router';
import { Screen, SegmentedControl, Text, useTheme, useThemeMode } from '@/shared/ui';

// Thin route: the light/dark/system toggle that used to sit on the Profile tab. Moved out
// behind the 3-dot settings sheet so the Profile tab itself stays decorative.
export default function AppearanceScreen() {
  const t = useTheme();
  const { mode, setMode } = useThemeMode();
  return (
    <Screen padded={false} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Appearance' }} />
      <ScrollView contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.md }}>
        <View style={{ gap: t.spacing.sm }}>
          <Text variant="heading">Theme</Text>
          <SegmentedControl
            options={
              [
                { label: 'System', value: 'system' },
                { label: 'Light', value: 'light' },
                { label: 'Dark', value: 'dark' },
              ] as const
            }
            value={mode}
            onChange={setMode}
          />
          <Text variant="caption">
            Choose light or dark, or follow your device. Saved on this device only.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
