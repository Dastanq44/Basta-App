import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Input, Screen, Text, useTheme, VisibilityToggle } from '@/shared/ui';
import { useI18n, type I18nKey } from '@/shared/i18n';
import { useSession } from '@/features/auth';
import {
  AvatarUploadError,
  GroupAvatarPicker,
  groupDescriptionSchema,
  groupNameSchema,
  uploadGroupAvatar,
  useGroupOverview,
  useMyGroups,
  useUpdateGroupMeta,
} from '@/features/groups';

const AVATAR_ERROR_KEY: Record<string, I18nKey> = {
  'not-signed-in': 'avatar.notSignedIn',
  'local-read': 'avatar.localRead',
  'bucket-missing': 'avatar.bucketMissing',
  'rls-denied': 'avatar.rlsDenied',
  'too-large': 'avatar.tooLarge',
  'invalid-type': 'avatar.invalidType',
  unknown: 'avatar.generic',
};

/** Map a typed avatar-upload failure to a localized, actionable message. */
function avatarUploadMessage(e: unknown, tr: (k: I18nKey) => string): string {
  if (e instanceof AvatarUploadError) {
    return tr(AVATAR_ERROR_KEY[e.kind] ?? 'avatar.generic');
  }
  return tr('avatar.generic');
}

// Thin route: owner edits name + description + avatar. Server enforces owner + not-archived.
export default function EditGroupScreen() {
  const t = useTheme();
  const router = useRouter();
  const { t: tr } = useI18n();
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
      setFieldError(parsedName.error.issues[0]?.message ?? tr('groupForm.invalidName'));
      return;
    }
    const parsedDesc = groupDescriptionSchema.safeParse(description);
    if (!parsedDesc.success) {
      setFieldError(parsedDesc.error.issues[0]?.message ?? tr('groupForm.invalidDesc'));
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
        // Upload phase — bug E: this catch used to swallow the error silently and the user saw
        // no feedback. Now surfaced via the dedicated uploadError state with a kind-specific,
        // actionable message (see avatarUploadMessage).
        try {
          avatarPath = await uploadGroupAvatar(id, avatarUri);
        } catch (e) {
          setUploadError(avatarUploadMessage(e, tr));
          return;
        }
      } else if (removeAvatar) {
        avatarPath = null;
      }
      await update.mutateAsync({
        groupId: id,
        name: parsedName.data,
        description: parsedDesc.data.trim() || null,
        // Preserve the 3-state: undefined = keep, null = remove, string = set. Do NOT
        // collapse null to undefined or removal silently becomes "keep" (avatar bug).
        avatarPath,
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
        <Stack.Screen options={{ title: tr('groupForm.editTitle') }} />
        <Text variant="muted">{tr('common.loading')}</Text>
      </Screen>
    );
  }
  if (!group) {
    return (
      <Screen>
        <Stack.Screen options={{ title: tr('groupForm.editTitle') }} />
        <Text variant="title">{tr('group.unavailable')}</Text>
        <Text variant="muted">{tr('group.unavailableBody')}</Text>
      </Screen>
    );
  }
  if (!isOwner) {
    return (
      <Screen>
        <Stack.Screen options={{ title: tr('groupForm.editTitle') }} />
        <Text variant="title">{tr('groupForm.onlyOwner')}</Text>
      </Screen>
    );
  }

  const previewUri = removeAvatar ? null : (avatarUri ?? overview.data?.avatarUrl ?? null);
  const hasExistingAvatar = !!overview.data?.avatarUrl;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Screen padded={false} edges={['bottom']}>
        <Stack.Screen options={{ title: tr('groupForm.editTitle') }} />
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
            label={tr('groupForm.name')}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            placeholder={tr('groupForm.name')}
            error={fieldError ?? undefined}
            editable={!busy}
          />
          <Input
            label={tr('groupForm.description')}
            value={description}
            onChangeText={setDescription}
            placeholder={tr('groupForm.descriptionPlaceholder')}
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
              value={!isPublic}
              onValueChange={(next) => setIsPublic(!next)}
              title={tr('groupForm.private')}
              description={tr('privacy.group.private')}
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
              <Button label={tr('common.cancel')} variant="secondary" onPress={() => router.back()} disabled={busy} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label={busy ? tr('common.saving') : tr('common.save')} onPress={onSubmit} loading={busy} disabled={busy} />
            </View>
          </View>
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}
