import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, Text, useTheme } from '@/shared/ui';
import { GroupCreateOrJoinForm } from '@/features/groups';
import { useCompleteOnboarding } from '@/features/onboarding';

// Thin route: composes the reusable form + onboarding completion. The form itself owns
// validation + create/join RPCs; this screen just wires the post-success behavior.
export default function JoinOrCreateGroupScreen() {
  const t = useTheme();
  const complete = useCompleteOnboarding();

  const finish = async () => {
    await complete.mutateAsync();
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <Screen padded={false}>
        <View style={{ padding: t.spacing.lg, gap: t.spacing.md }}>
          <Text variant="title">Join or create a group</Text>
          <GroupCreateOrJoinForm
            onCreated={finish}
            onJoined={finish}
            headerCopy="Friends keep each other honest. Start a new group or join one with an invite code."
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
