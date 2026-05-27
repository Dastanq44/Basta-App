import { Screen, Text } from '@/shared/ui';

// Route shell only — email/PKCE sign-in is implemented in Phase 1 (auth feature, T-020).
export default function SignInScreen() {
  return (
    <Screen>
      <Text variant="title">Sign in</Text>
      <Text variant="muted">Email sign-in coming in Phase 1.</Text>
    </Screen>
  );
}
