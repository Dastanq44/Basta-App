import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  CHALLENGE_CATEGORIES,
  createChallengeInput,
  useCreateChallenge,
  type ChallengeCategory,
  type CreateChallengeInput,
} from '@/features/challenges';
import { useMyGroups } from '@/features/groups';
import { Button, Input, Screen, Text, useTheme } from '@/shared/ui';

type FieldErrors = Partial<Record<keyof CreateChallengeInput, string>>;

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function CreateChallengeScreen() {
  const t = useTheme();
  const router = useRouter();
  const create = useCreateChallenge();
  const groups = useMyGroups();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ChallengeCategory>('fitness');
  const [mode, setMode] = useState<'solo' | 'group'>('solo');
  const [groupId, setGroupId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(todayISO());
  const [durationDays, setDurationDays] = useState('30');
  const [proofRequirement, setProofRequirement] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  const onSubmit = async () => {
    setErrors({});
    const parsed = createChallengeInput.safeParse({
      title,
      category,
      mode,
      startDate,
      durationDays: Number(durationDays),
      proofRequirement: proofRequirement.trim() || undefined,
      groupId: mode === 'group' ? groupId : null,
    });
    if (!parsed.success) {
      const errs: FieldErrors = {};
      parsed.error.issues.forEach((i) => {
        const k = i.path[0] as keyof CreateChallengeInput | undefined;
        if (k && !errs[k]) errs[k] = i.message;
      });
      setErrors(errs);
      return;
    }
    if (parsed.data.mode === 'group' && !parsed.data.groupId) {
      setErrors({ groupId: 'Pick a group' });
      return;
    }
    try {
      const id = await create.mutateAsync(parsed.data);
      router.replace({ pathname: '/challenge/[id]', params: { id } });
    } catch {
      /* surfaced via mutationError below */
    }
  };

  const mutationError = create.error instanceof Error ? create.error.message : null;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Screen padded={false}>
        <Stack.Screen options={{ title: 'New challenge' }} />
        <ScrollView contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.lg, paddingBottom: t.spacing.xl }}>
          <Input
            label="Title"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. 30 days of pushups"
            error={errors.title}
            editable={!create.isPending}
          />
          <View style={{ gap: t.spacing.xs }}>
            <Text variant="caption">Category</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs }}>
              {CHALLENGE_CATEGORIES.map((c) => (
                <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />
              ))}
            </View>
            {errors.category ? (
              <Text variant="caption" style={{ color: t.colors.destructive }}>{errors.category}</Text>
            ) : null}
          </View>
          <View style={{ gap: t.spacing.xs }}>
            <Text variant="caption">Mode</Text>
            <View style={{ flexDirection: 'row', gap: t.spacing.xs }}>
              <Chip label="Solo" selected={mode === 'solo'} onPress={() => setMode('solo')} />
              <Chip label="Group" selected={mode === 'group'} onPress={() => setMode('group')} />
            </View>
          </View>
          {mode === 'group' ? (
            <View style={{ gap: t.spacing.xs }}>
              <Text variant="caption">Group</Text>
              {groups.isPending ? (
                <Text variant="muted">Loading groups…</Text>
              ) : !groups.data || groups.data.length === 0 ? (
                <Text variant="muted">You're not in a group yet. Join or create one first.</Text>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs }}>
                  {groups.data.map((g) => (
                    <Chip key={g.id} label={g.name} selected={groupId === g.id} onPress={() => setGroupId(g.id)} />
                  ))}
                </View>
              )}
              {errors.groupId ? (
                <Text variant="caption" style={{ color: t.colors.destructive }}>{errors.groupId}</Text>
              ) : null}
            </View>
          ) : null}
          <Input
            label="Start date"
            value={startDate}
            onChangeText={setStartDate}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
            error={errors.startDate}
            editable={!create.isPending}
          />
          <Input
            label="Duration (days)"
            value={durationDays}
            onChangeText={(v) => setDurationDays(v.replace(/\D/g, '').slice(0, 3))}
            placeholder="30"
            keyboardType="number-pad"
            error={errors.durationDays}
            editable={!create.isPending}
          />
          <Input
            label="Proof requirement (optional)"
            value={proofRequirement}
            onChangeText={setProofRequirement}
            placeholder="e.g. photo of completed workout"
            error={errors.proofRequirement}
            editable={!create.isPending}
          />
          {mutationError ? (
            <Text variant="caption" style={{ color: t.colors.destructive }}>{mutationError}</Text>
          ) : null}
          <Button
            label={create.isPending ? 'Creating…' : 'Create challenge'}
            onPress={onSubmit}
            loading={create.isPending}
            disabled={create.isPending}
          />
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
