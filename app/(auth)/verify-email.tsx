import { Screen, Text } from '@/shared/ui';

// Route shell only — email verification (one-time token in body, never URL — W-005). Phase 1.
export default function VerifyEmailScreen() {
  return (
    <Screen>
      <Text variant="title">Verify your email</Text>
      <Text variant="muted">Email verification coming in Phase 1.</Text>
    </Screen>
  );
}
