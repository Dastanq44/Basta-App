import { Screen, Text } from '@/shared/ui';

// Route shell only — profile setup; onboarding is gated on the server `profiles.onboarded` flag. Phase 1 (T-022).
export default function ProfileSetupScreen() {
  return (
    <Screen>
      <Text variant="title">Set up your profile</Text>
      <Text variant="muted">Profile setup coming in Phase 1.</Text>
    </Screen>
  );
}
