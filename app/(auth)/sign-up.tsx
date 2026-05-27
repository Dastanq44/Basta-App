import { Screen, Text } from '@/shared/ui';

// Route shell only — registration (+ terms acceptance gate) is implemented in Phase 1 (T-020/T-021).
export default function SignUpScreen() {
  return (
    <Screen>
      <Text variant="title">Create account</Text>
      <Text variant="muted">Registration coming in Phase 1.</Text>
    </Screen>
  );
}
