import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Input, Screen, Text, useTheme, VisibilityToggle } from '@/shared/ui';
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
  const [isPublic, setIsPublic] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  /** When the user taps "Remove photo": forces avatarPath=null on save (clearing the
   *  existing remote avatar) — separate from the local preview, which is `null` both for
   *  "no change" and "explicit remove". */
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [descHydrated, setDescHydrated] = useState(false);
  const [busy, setBusy] = useState(false);

  // Seed name + description once their sources resolve (one-shot — don't clobber edits).
  useEffect(() => {
    if (hydrated || !group) return;
    setName(group.name);
    setIsPublic(group.isPublic);
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
    setUploadError(null);
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
    // avatarPath:
    //   undefined → not set, keep existing (default on the RPC)
    //   null      → explicit removal
    //   string    → new uploaded path
    let avatarPath: string | null | undefined = undefined;
    try {
      if (avatarUri) {
        // Upload phase — bug E: previously the catch swallowed this silently and the
        // user saw no feedback. Now surfaced via the dedicated uploadError state.
        try {
          avatarPath = await uploadGroupAvatar(id, avatarUri);
        } catch (e) {
          setUploadError(
            e instanceof Error
              ? `Could not upload photo: ${e.message}. If this says "row-level security", check the Supabase project your app points at (EXPO_PUBLIC_SUPABASE_URL) has the "group-avatars" Storage bucket created — buckets are a manual Dashboard step, not part of the migration.`
              : 'Could not upload photo. Try again.',
          );
          return;
        }
      } else if (removeAvatar) {
        avatarPath = null;
      }
      await update.mutateAsync({
        groupId: id,
        name: parsedName.data,
        description: parsedDesc.data.trim() || null,
        avatarPath: avatarPath ?? undefined,
        isPublic,
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

  const previewUri = removeAvatar ? null : (avatarUri ?? overview.data?.avatarUrl ?? null);
  const hasExistingAvatar = !!overview.data?.avatarUrl;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Screen padded={false} edges={['bottom']}>
        <Stack.Screen options={{ title: 'Edit group' }} />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.lg, paddingBottom: t.spacing.xl }}
        >
          <GroupAvatarPicker
            uri={previewUri}
            onPick={(uri) => {
              setAvatarUri(uri);
              setRemoveAvatar(false);
            }}
            onRemove={
              hasExistingAvatar || avatarUri
                ? () => {
                    setAvatarUri(null);
                    setRemoveAvatar(true);
                  }
                : undefined
            }
          />
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
          <View
            style={{
              backgroundColor: t.colors.card,
              borderRadius: t.radius.xl,
              borderWidth: 1,
              borderColor: t.colors.border,
              padding: t.spacing.lg,
            }}
          >
            <VisibilityToggle
              value={isPublic}
              onValueChange={setIsPublic}
              title="Public group"
              description={
                isPublic
                  ? 'Discoverable in Global. The invite code stays private.'
                  : 'Private — only members can see this group.'
              }
              disabled={busy}
            />
          </View>
          {uploadError ? (
            <Text variant="caption" style={{ color: t.colors.destructive }}>
              {uploadError}
            </Text>
          ) : null}
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
