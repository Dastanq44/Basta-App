import { useLocalSearchParams } from 'expo-router';
import { Screen, Text } from '@/shared/ui';

// Thin route: reads the param, defers content to the challenges feature (Phase 2).
export default function ChallengeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Screen>
      <Text variant="title">Challenge</Text>
      <Text variant="muted">Detail for challenge {id} — coming in Phase 2.</Text>
    </Screen>
  );
}
