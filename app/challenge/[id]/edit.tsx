import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  CHALLENGE_CATEGORIES,
  updateChallengeInput,
  useChallenge,
  useUpdateChallenge,
  type ChallengeCategory,
  type UpdateChallengeInput,
} from '@/features/challenges';
import { useSession } from '@/features/auth';
import { Button, Input, Screen, Text, useTheme, VisibilityToggle } from '@/shared/ui';

type FieldErrors = Partial<Record<keyof UpdateChallengeInput, string>>;

// Thin route: edit the mutable fields on an active challenge (creator-only).
// start_date / mode / group_id / threshold are NOT shown — changing them would invalidate
// existing submissions; that lives behind a future "duplicate as new challenge" affordance.
export default function EditChallengeScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession();
  const myUid = session.session?.user.id;
  const challenge = useChallenge(id);
  const update = useUpdateChallenge();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ChallengeCategory>('fitness');
  const [durationDays, setDurationDays] = useState('');
  const [proofRequirement, setProofRequirement] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [hydrated, setHydrated] = useState(false);

  // Seed the form once challenge data resolves, then leave the user's edits alone.
  useEffect(() => {
    if (hydrated || !challenge.data) return;
    setTitle(challenge.data.title);
    setCategory(challenge.data.category as ChallengeCategory);
    setDurationDays(String(challenge.data.durationDays));
    setProofRequirement(challenge.data.proofRequirement ?? '');
    setIsPublic(challenge.data.isPublic);
    setHydrated(true);
  }, [challenge.data, hydrated]);

  if (challenge.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Edit challenge' }} />
        <Text variant="muted">Loading…</Text>
      </Screen>
    );
  }
  if (challenge.isError || !challenge.data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Edit challenge' }} />
        <Text variant="title">Challenge unavailable</Text>
        <Text variant="caption" style={{ color: t.colors.destructive }}>
          {challenge.error instanceof Error ? challenge.error.message : 'Could not load.'}
        </Text>
      </Screen>
    );
  }

  const c = challenge.data;
  const isCreator = !!myUid && c.creatorId === myUid;
  const isArchived = !!c.archivedAt;

  if (!isCreator) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Edit challenge' }} />
        <Text variant="title">Only the creator can edit this challenge</Text>
      </Screen>
    );
  }
  if (isArchived) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Edit challenge' }} />
        <Text variant="title">Archived challenges can't be edited</Text>
        <Text variant="muted">Restore the challenge first (not yet supported) to edit it.</Text>
      </Screen>
    );
  }

  const onSubmit = async () => {
    if (!id) return;
    setErrors({});
    const parsed = updateChallengeInput.safeParse({
      title,
      category,
      durationDays: Number(durationDays),
      proofRequirement: proofRequirement.trim() || undefined,
      isPublic,
    });
    if (!parsed.success) {
      const errs: FieldErrors = {};
      parsed.error.issues.forEach((i) => {
        const k = i.path[0] as keyof UpdateChallengeInput | undefined;
        if (k && !errs[k]) errs[k] = i.message;
      });
      setErrors(errs);
      return;
    }
    try {
      await update.mutateAsync({ challengeId: id, input: parsed.data });
      router.back();
    } catch {
      /* surfaced via update.error */
    }
  };

  const submitError = update.error instanceof Error ? update.error.message : null;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Screen padded={false}>
        <Stack.Screen options={{ title: 'Edit challenge' }} />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.lg, paddingBottom: t.spacing.xl }}
        >
          <Input
            label="Title"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. 30 days of pushups"
            error={errors.title}
            editable={!update.isPending}
          />
          <View style={{ gap: t.spacing.xs }}>
            <Text variant="caption">Category</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs }}>
              {CHALLENGE_CATEGORIES.map((cat) => (
                <Chip
                  key={cat}
                  label={cat}
                  selected={category === cat}
                  onPress={() => setCategory(cat)}
                />
              ))}
            </View>
            {errors.category ? (
              <Text variant="caption" style={{ color: t.colors.destructive }}>{errors.category}</Text>
            ) : null}
          </View>
          <Input
            label="Duration (days)"
            value={durationDays}
            onChangeText={(v) => setDurationDays(v.replace(/\D/g, '').slice(0, 3))}
            placeholder="30"
            keyboardType="number-pad"
            error={errors.durationDays}
            editable={!update.isPending}
          />
          <Input
            label="Proof requirement (optional)"
            value={proofRequirement}
            onChangeText={setProofRequirement}
            placeholder="e.g. photo of completed workout"
            error={errors.proofRequirement}
            editable={!update.isPending}
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
              title="Public challenge"
              description="Required before proofs from this challenge can appear in Global."
              disabled={update.isPending}
            />
          </View>
          {submitError ? (
            <Text variant="caption" style={{ color: t.colors.destructive }}>{submitError}</Text>
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

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={4}
      style={{
        paddingHorizontal: t.spacing.md,
        paddingVertical: 8,
        borderRadius: t.radius.lg,
        borderWidth: 1,
        borderColor: selected ? t.colors.primary : t.colors.border,
        backgroundColor: selected ? t.colors.accent : 'transparent',
      }}
    >
      <Text style={{ color: selected ? t.colors.accentForeground : t.colors.foreground, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}
