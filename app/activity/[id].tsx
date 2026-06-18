import { ActivityIndicator, ScrollView, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Screen, Text, useTheme } from '@/shared/ui';
import { useUserRecentSubmissions } from '@/features/proofs';
import { ActivityHeatmap } from '@/features/profile';

// Full 90-day activity calendar — opened from the profile's "View full activity →". Reuses the
// existing ActivityHeatmap. Data is the same visibility-aware submissions list as the profile.
export default function ActivityScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const submissions = useUserRecentSubmissions(id);

  return (
    <Screen padded={false} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Activity' }} />
      <ScrollView contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.md }}>
        {submissions.isPending ? (
          <View style={{ alignItems: 'center', paddingTop: t.spacing.xxl }}>
            <ActivityIndicator color={t.colors.primary} />
          </View>
        ) : submissions.isError ? (
          <Text variant="muted">Couldn&apos;t load activity. Go back and try again.</Text>
        ) : (
          <ActivityHeatmap submissions={submissions.data ?? []} />
        )}
      </ScrollView>
    </Screen>
  );
}
