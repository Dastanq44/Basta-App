import { Stack } from 'expo-router';

// Group layout for the (onboarding) flow: profile setup, join-or-create-group.
// Back button hidden so users can't skip steps (T-022).
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{ headerShown: true, headerBackVisible: false, headerTitle: '' }}
    />
  );
}
