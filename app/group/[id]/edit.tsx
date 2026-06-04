import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Input, Screen, Text, useTheme } from '@/shared/ui';
import { useSession } from '@/features/auth';
import {
  GroupAvatarPicker,
  groupDescriptionSchema,
  groupNameSchema,
  uploadGroupAvatar,
  useGroupOverview,
  useMyGroups,
  useUpdateGroupMeta,
} from '@/features/groups';

// Thin route: owner edits name + description + avatar. Server enforces owner + not-archived.
export default function EditGroupScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession();
  const myUid = session.session?.user.id;
  const groups = useMyGroups();
  const overview = useGroupOverview(id);
  const update = useUpdateGroupMeta();

  const group = groups.data?.find((g) => g.id === id);
  const isOwner = !!myUid && group?.ownerId === myUid;

  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [descHydrated, setDescHydrated] = useState(false);
  const [busy, setBusy] = useState(false);

  // Seed name + description once their sources resolve (one-shot — don't clobber edits).
  useEffect(() => {
    if (hydrated || !group) return;
    setName(group.name);
    setHydrated(true);
  }, [group, hydrated]);
  useEffect(() => {
    if (descHydrated || overview.data == null) return;
    setDescription(overview.data.description ?? '');
    setDescHydrated(true);
  }, [overview.data, descHydrated]);

  const submitError = update.error instanceof Error ? update.error.message : null;

  const onSubmit = async () => {
    if (!id) return;
    setFieldError(null);
    const parsedName = groupNameSchema.safeParse(name);
    if (!parsedName.success) {
      setFieldError(parsedName.error.issues[0]?.message ?? 'Invalid name');
      return;
    }
    const parsedDesc = groupDescriptionSchema.safeParse(description);
    if (!parsedDesc.success) {
      setFieldError(parsedDesc.error.issues[0]?.message ?? 'Invalid description');
      return;
    }
    setBusy(true);
    try {
      let avatarPath: string | null = null; // null = keep the existing avatar
      if (avatarUri) avatarPath = await uploadGroupAvatar(id, avatarUri);
      await update.mutateAsync({
        groupId: id,
        name: parsedName.data,
        description: parsedDesc.data.trim() || null,
        avatarPath,
      });
      router.back();
    } catch {
      /* surfaced via submitError */
    } finally {
      setBusy(false);
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
        <Text variant="muted">This group is archived or you&apos;re no longer a member.</Text>
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

  const previewUri = avatarUri ?? overview.data?.avatarUrl ?? null;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Screen padded={false}>
        <Stack.Screen options={{ title: 'Edit group' }} />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.lg, paddingBottom: t.spacing.xl }}
        >
          <GroupAvatarPicker uri={previewUri} onPick={setAvatarUri} />
          <Input
            label="Group name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            placeholder="Group name"
            error={fieldError ?? undefined}
            editable={!busy}
          />
          <Input
            label="Description (optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="What's this group about?"
            multiline
            maxLength={280}
            editable={!busy}
          />
          {submitError ? (
            <Text variant="caption" style={{ color: t.colors.destructive }}>
              {submitError}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: t.spacing.md }}>
            <View style={{ flex: 1 }}>
              <Button label="Cancel" variant="secondary" onPress={() => router.back()} disabled={busy} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label={busy ? 'Saving…' : 'Save'} onPress={onSubmit} loading={busy} disabled={busy} />
            </View>
          </View>
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}
