import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Input, Screen, Text, useTheme } from '@/shared/ui';
import { useSession } from '@/features/auth';
import {
  groupNameSchema,
  useMyGroups,
  useUpdateGroup,
} from '@/features/groups';

// Thin route: rename an active group (owner-only). The server also enforces owner +
// not-archived; this screen just guards the UI from non-owners.
export default function EditGroupScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession();
  const myUid = session.session?.user.id;
  const groups = useMyGroups();
  const update = useUpdateGroup();

  const group = groups.data?.find((g) => g.id === id);
  const isOwner = !!myUid && group?.ownerId === myUid;

  const [name, setName] = useState(group?.name ?? '');
  const [fieldError, setFieldError] = useState<string | null>(null);

  // Hydrate the input once the groups list resolves (we may have landed on this route
  // before useMyGroups returned data).
  useEffect(() => {
    if (group && name === '') setName(group.name);
  }, [group, name]);

  const onSubmit = async () => {
    if (!id) return;
    setFieldError(null);
    const parsed = groupNameSchema.safeParse(name);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Invalid name');
      return;
    }
    if (parsed.data === group?.name) {
      router.back();
      return;
    }
    try {
      await update.mutateAsync({ groupId: id, name: parsed.data });
      router.back();
    } catch {
      /* surfaced via update.error */
    }
  };

  if (groups.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Edit group' }} />
        <Text variant="muted">Loading…</Text>
      </Screen>
    );
  }

  if (!group) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Edit group' }} />
        <Text variant="title">Group unavailable</Text>
        <Text variant="muted">This group is archived or you're no longer a member.</Text>
      </Screen>
    );
  }

  if (!isOwner) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Edit group' }} />
        <Text variant="title">Only the owner can edit this group</Text>
      </Screen>
    );
  }

  const submitError = update.error instanceof Error ? update.error.message : null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <Screen padded={false}>
        <Stack.Screen options={{ title: 'Edit group' }} />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.lg, paddingBottom: t.spacing.xl }}
        >
          <Input
            label="Group name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            placeholder="Group name"
            error={fieldError ?? undefined}
            editable={!update.isPending}
          />
          {submitError ? (
            <Text variant="caption" style={{ color: t.colors.destructive }}>
              {submitError}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: t.spacing.md }}>
            <View style={{ flex: 1 }}>
              <Button
                label="Cancel"
                variant="secondary"
                onPress={() => router.back()}
                disabled={update.isPending}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={update.isPending ? 'Saving…' : 'Save'}
                onPress={onSubmit}
                loading={update.isPending}
                disabled={update.isPending}
              />
            </View>
          </View>
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}
