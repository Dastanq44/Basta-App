import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { type Href, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, Text, useTheme } from '@/shared/ui';
import { GroupCreateOrJoinForm, type GroupCreateOrJoinMode } from '@/features/groups';

// Modal route — main-app entry point for create/join after onboarding. On success we
// dismiss the modal and navigate to the new/joined group's detail screen.
// Optional `?mode=join` query lets the Groups tab pre-select the Join tab.
export default function JoinOrCreateGroupModal() {
  const t = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const initialMode: GroupCreateOrJoinMode = params.mode === 'join' ? 'join' : 'create';
  // Once we've routed to the group, prevent further callback invocations from racing.
  const [navigated, setNavigated] = useState(false);

  const goToGroup = (groupId: string) => {
    if (navigated) return;
    setNavigated(true);
    // typedRoutes hasn't generated /group/[id] yet; cast the href.
    router.replace(`/group/${groupId}` as Href);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <Screen padded={false}>
        <Stack.Screen options={{ title: 'New group' }} />
        <View style={{ padding: t.spacing.lg, gap: t.spacing.md }}>
          <Text variant="title">Join or create a group</Text>
          <GroupCreateOrJoinForm
            initialMode={initialMode}
            onCreated={goToGroup}
            onJoined={goToGroup}
            headerCopy="Start a new group or join one with an invite code."
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
