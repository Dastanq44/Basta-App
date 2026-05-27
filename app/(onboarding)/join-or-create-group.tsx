import { Screen, Text } from '@/shared/ui';

// Route shell only — join via invite link / search, or create a group. Phase 1 (T-023).
export default function JoinOrCreateGroupScreen() {
  return (
    <Screen>
      <Text variant="title">Join or create a group</Text>
      <Text variant="muted">Group join/create coming in Phase 1.</Text>
    </Screen>
  );
}
