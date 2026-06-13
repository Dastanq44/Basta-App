import { useEffect, useMemo, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Avatar, Button, Input, Screen, Text, useTheme, VisibilityToggle } from '@/shared/ui';
import {
  deleteMyAvatar,
  displayNameSchema,
  profileDescriptionSchema,
  uploadMyAvatar,
  userAvatarUrl,
  useProfile,
  usernameSchema,
  useUpdateMyProfile,
} from '@/features/onboarding';
import { pickAvatar } from '@/shared/lib/pickAvatar';

// Edit profile: avatar, display name, username, description. Validation mirrors the
// onboarding profile-setup screen so the same constraints apply. Avatar upload + remove
// are best-effort: failures surface inline so the user knows why nothing saved (avoids
// the silent-stuck-window bug E we fixed for groups).
export default function EditProfileScreen() {
  const t = useTheme();
  const router = useRouter();
  const profile = useProfile();
  const update = useUpdateMyProfile();

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [opError, setOpError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);

  // One-shot seeding from server data so user edits don't get clobbered on refetch.
  useEffect(() => {
    if (hydrated || !profile.data) return;
    setDisplayName(profile.data.displayName ?? '');
    setUsername(profile.data.username ?? '');
    setDescription(profile.data.description ?? '');
    setIsPublic(profile.data.isPublic);
    setHydrated(true);
  }, [profile.data, hydrated]);

  const remoteAvatarUrl = useMemo(
    () => userAvatarUrl(profile.data?.avatarUrl ?? null),
    [profile.data?.avatarUrl],
  );
  const previewUri = removeAvatar ? null : (avatarUri ?? remoteAvatarUrl);
  const hasExistingAvatar = !!remoteAvatarUrl;

  const onPickAvatar = async () => {
    const res = await pickAvatar({
      allowRemove: hasExistingAvatar || !!avatarUri,
      title: hasExistingAvatar || avatarUri ? 'Change profile photo' : 'Add profile photo',
    });
    if (res.kind === 'picked') {
      setAvatarUri(res.uri);
      setRemoveAvatar(false);
    } else if (res.kind === 'removed') {
      setAvatarUri(null);
      setRemoveAvatar(true);
    }
  };

  const onSubmit = async () => {
    setFieldError(null);
    setOpError(null);

    const parsedName = displayNameSchema.safeParse(displayName);
    if (!parsedName.success) {
      setFieldError(parsedName.error.issues[0]?.message ?? 'Invalid name');
      return;
    }
    const parsedUsername = usernameSchema.safeParse(username);
    if (!parsedUsername.success) {
      setFieldError(parsedUsername.error.issues[0]?.message ?? 'Invalid username');
      return;
    }
    const parsedDesc = profileDescriptionSchema.safeParse(description);
    if (!parsedDesc.success) {
      setFieldError(parsedDesc.error.issues[0]?.message ?? 'Invalid description');
      return;
    }

    setBusy(true);
    try {
      // Storage operations first, so a failure stops the save before mutating profiles.
      let avatarPath: string | null | undefined = undefined;
      if (avatarUri) {
        try {
          avatarPath = await uploadMyAvatar(avatarUri);
        } catch (e) {
          setOpError(
            e instanceof Error
              ? `Could not upload photo: ${e.message}. If this says "row-level security", check the Supabase project your app points at (EXPO_PUBLIC_SUPABASE_URL) has the "user-avatars" Storage bucket created — buckets are a manual Dashboard step, not part of the migration.`
              : 'Could not upload photo. Try again.',
          );
          return;
        }
      } else if (removeAvatar) {
        // Best-effort: ignore delete failures (the file may simply not exist).
        try {
          await deleteMyAvatar();
        } catch (e) {
          console.warn('[basta] deleteMyAvatar failed (ignored):', e);
        }
        avatarPath = null;
      }

      await update.mutateAsync({
        username: parsedUsername.data,
        displayName: parsedName.data,
        description: parsedDesc.data.trim() || null,
        // Preserve the 3-state: undefined = keep, null = remove, string = set. Collapsing
        // null to undefined made avatar removal a no-op (the updateMyProfile patch only sets
        // avatar_url when avatarPath !== undefined).
        avatarPath,
        isPublic,
      });
      router.back();
    } catch (e) {
      setOpError(e instanceof Error ? e.message : 'Could not save profile.');
    } finally {
      setBusy(false);
    }
  };

  if (profile.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Edit profile' }} />
        <Text variant="muted">Loading…</Text>
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Screen padded={false} edges={['bottom']}>
        <Stack.Screen options={{ title: 'Edit profile' }} />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.lg, paddingBottom: t.spacing.xl }}
        >
          {/* Avatar */}
          <Pressable accessibilityRole="button" onPress={onPickAvatar} style={{ alignSelf: 'center' }}>
            {previewUri ? (
              <Image source={{ uri: previewUri }} style={{ width: 96, height: 96, borderRadius: 48 }} />
            ) : (
              <Avatar name={displayName || 'You'} size={96} />
            )}
            <Text variant="caption" style={{ color: t.colors.primary, textAlign: 'center', marginTop: 6 }}>
              {previewUri ? 'Change photo' : 'Add photo'}
            </Text>
          </Pressable>

          <Input
            label="Display name"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            autoCapitalize="words"
            editable={!busy}
          />
          <Input
            label="Username"
            value={username}
            onChangeText={setUsername}
            placeholder="username"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
          />
          <Input
            label="Description (optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="A short bio about yourself"
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
              title="Public profile"
              description="Required for your posts to appear in Global."
              disabled={busy}
            />
          </View>

          {fieldError ? (
            <Text variant="caption" style={{ color: t.colors.destructive }}>
              {fieldError}
            </Text>
          ) : null}
          {opError ? (
            <Text variant="caption" style={{ color: t.colors.destructive }}>
              {opError}
            </Text>
          ) : null}

          <View style={{ flexDirection: 'row', gap: t.spacing.md }}>
            <View style={{ flex: 1 }}>
              <Button label="Cancel" variant="secondary" onPress={() => router.back()} disabled={busy} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label={busy ? 'Saving…' : 'Save'}
                onPress={onSubmit}
                loading={busy}
                disabled={busy}
              />
            </View>
          </View>
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}
