import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  CHALLENGE_CATEGORIES,
  createChallengeInput,
  useCreateChallenge,
  type ChallengeCategory,
} from '@/features/challenges';
import { useMyGroups } from '@/features/groups';
import { Button, Chip, Input, ProgressBar, Screen, Text, useTheme } from '@/shared/ui';

const EMOJIS = ['💪', '🏃', '📚', '🧘', '🎨', '✍️', '💻', '🌅', '💧', '🥗', '😴', '🎯', '🔥', '⭐', '🏆', '🎸', '🚭', '🧠', '🏋️', '☀️'];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function isISO(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00`).getTime());
}
/** Inclusive day count between two ISO dates, or null if invalid. */
function diffDaysInclusive(start: string, end: string): number | null {
  if (!isISO(start) || !isISO(end)) return null;
  const s = new Date(`${start}T00:00:00`).getTime();
  const e = new Date(`${end}T00:00:00`).getTime();
  return Math.round((e - s) / 86_400_000) + 1;
}

// Step-by-step new-challenge wizard: [type?] → category → name+emoji → start → end → description.
// The "type" step is skipped when a groupId param is passed (created from inside a group).
// No migration: emoji is prefixed onto the title; start+end become duration_days; the description
// is stored in proof_requirement.
export default function CreateChallengeScreen() {
  const t = useTheme();
  const router = useRouter();
  const create = useCreateChallenge();
  const groups = useMyGroups();
  const params = useLocalSearchParams<{ groupId?: string }>();
  const presetGroupId = typeof params.groupId === 'string' ? params.groupId : null;

  const needsType = !presetGroupId;
  const stepKeys = needsType
    ? (['type', 'category', 'name', 'start', 'end', 'desc'] as const)
    : (['category', 'name', 'start', 'end', 'desc'] as const);

  const [stepIdx, setStepIdx] = useState(0);
  const [mode, setMode] = useState<'solo' | 'group'>(presetGroupId ? 'group' : 'solo');
  const [groupId, setGroupId] = useState<string | null>(presetGroupId);
  const [category, setCategory] = useState<ChallengeCategory>('fitness');
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('💪');
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(addDaysISO(todayISO(), 29));
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const step = stepKeys[stepIdx];
  const isLast = stepIdx === stepKeys.length - 1;
  const mutationError = create.error instanceof Error ? create.error.message : null;

  const validateStep = (): boolean => {
    setError(null);
    if (step === 'type') {
      if (mode === 'group' && !groupId) {
        setError('Pick a group');
        return false;
      }
    } else if (step === 'name') {
      if (name.trim().length === 0) {
        setError('Give your challenge a name');
        return false;
      }
    } else if (step === 'start') {
      if (!isISO(startDate)) {
        setError('Enter a valid start date (YYYY-MM-DD)');
        return false;
      }
    } else if (step === 'end') {
      const days = diffDaysInclusive(startDate, endDate);
      if (days == null) {
        setError('Enter a valid end date (YYYY-MM-DD)');
        return false;
      }
      if (days < 1) {
        setError('End date must be on or after the start date');
        return false;
      }
      if (days > 365) {
        setError('Challenge can be at most 365 days');
        return false;
      }
    }
    return true;
  };

  const onNext = async () => {
    if (!validateStep()) return;
    if (!isLast) {
      setStepIdx((i) => i + 1);
      return;
    }
    // Final submit.
    const days = diffDaysInclusive(startDate, endDate);
    const title = `${emoji ? `${emoji} ` : ''}${name.trim()}`;
    const parsed = createChallengeInput.safeParse({
      title,
      category,
      mode,
      startDate,
      durationDays: days ?? 0,
      proofRequirement: description.trim() || undefined,
      groupId: mode === 'group' ? groupId : null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check your inputs');
      return;
    }
    try {
      const id = await create.mutateAsync(parsed.data);
      router.replace({ pathname: '/challenge/[id]', params: { id } });
    } catch {
      /* surfaced via mutationError */
    }
  };

  const onBack = () => {
    setError(null);
    if (stepIdx === 0) router.back();
    else setStepIdx((i) => i - 1);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Screen padded={false}>
        <Stack.Screen options={{ title: 'New challenge' }} />
        <View style={{ paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.md, gap: t.spacing.xs }}>
          <Text variant="label">
            STEP {stepIdx + 1} OF {stepKeys.length}
          </Text>
          <ProgressBar value={(stepIdx + 1) / stepKeys.length} />
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.lg, paddingBottom: t.spacing.xl }}
        >
          {step === 'type' ? (
            <View style={{ gap: t.spacing.md }}>
              <Text variant="heading">Solo or group?</Text>
              <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
                <Chip label="Solo" selected={mode === 'solo'} onPress={() => setMode('solo')} />
                <Chip label="Group" selected={mode === 'group'} onPress={() => setMode('group')} />
              </View>
              {mode === 'group' ? (
                groups.isPending ? (
                  <Text variant="muted">Loading groups…</Text>
                ) : !groups.data || groups.data.length === 0 ? (
                  <Text variant="muted">You&apos;re not in a group yet. Create or join one first.</Text>
                ) : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
                    {groups.data.map((g) => (
                      <Chip key={g.id} label={g.name} selected={groupId === g.id} onPress={() => setGroupId(g.id)} />
                    ))}
                  </View>
                )
              ) : null}
            </View>
          ) : step === 'category' ? (
            <View style={{ gap: t.spacing.md }}>
              <Text variant="heading">Pick a category</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
                {CHALLENGE_CATEGORIES.map((c) => (
                  <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />
                ))}
              </View>
            </View>
          ) : step === 'name' ? (
            <View style={{ gap: t.spacing.md }}>
              <Text variant="heading">Name &amp; icon</Text>
              <View style={{ alignItems: 'center', gap: t.spacing.xs }}>
                <View
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 24,
                    backgroundColor: t.colors.primarySoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 36 }}>{emoji || '🙂'}</Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm, justifyContent: 'center' }}>
                {EMOJIS.map((e) => (
                  <Pressable
                    key={e}
                    accessibilityRole="button"
                    onPress={() => setEmoji(e)}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: t.radius.md,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: emoji === e ? t.colors.primarySoft : t.colors.muted,
                      borderWidth: emoji === e ? 1.5 : 0,
                      borderColor: t.colors.primary,
                    }}
                  >
                    <Text style={{ fontSize: 22 }}>{e}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
                <Text variant="caption">Or type any emoji:</Text>
                <TextInput
                  value={emoji}
                  onChangeText={setEmoji}
                  placeholder="🙂"
                  placeholderTextColor={t.colors.mutedForeground}
                  style={{
                    minWidth: 56,
                    textAlign: 'center',
                    fontSize: 22,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderWidth: 1,
                    borderColor: t.colors.border,
                    borderRadius: t.radius.md,
                    color: t.colors.foreground,
                  }}
                />
              </View>
              <Input
                label="Name"
                value={name}
                onChangeText={setName}
                placeholder="e.g. Morning run"
                autoCapitalize="sentences"
                editable={!create.isPending}
              />
            </View>
          ) : step === 'start' ? (
            <View style={{ gap: t.spacing.md }}>
              <Text variant="heading">Start date</Text>
              <Input
                label="Start (YYYY-MM-DD)"
                value={startDate}
                onChangeText={setStartDate}
                autoCapitalize="none"
                placeholder="2026-06-05"
                editable={!create.isPending}
              />
            </View>
          ) : step === 'end' ? (
            <View style={{ gap: t.spacing.md }}>
              <Text variant="heading">End date</Text>
              <Input
                label="End (YYYY-MM-DD)"
                value={endDate}
                onChangeText={setEndDate}
                autoCapitalize="none"
                placeholder="2026-07-05"
                editable={!create.isPending}
              />
              {diffDaysInclusive(startDate, endDate) != null ? (
                <Text variant="muted">{diffDaysInclusive(startDate, endDate)} day challenge</Text>
              ) : null}
            </View>
          ) : (
            <View style={{ gap: t.spacing.md }}>
              <Text variant="heading">Description (optional)</Text>
              <Input
                label="What's the challenge about? / what proof to submit"
                value={description}
                onChangeText={setDescription}
                placeholder="e.g. a photo of your completed run"
                multiline
                maxLength={280}
                editable={!create.isPending}
              />
            </View>
          )}

          {error ? (
            <Text variant="caption" style={{ color: t.colors.destructive }}>
              {error}
            </Text>
          ) : null}
          {mutationError ? (
            <Text variant="caption" style={{ color: t.colors.destructive }}>
              {mutationError}
            </Text>
          ) : null}
        </ScrollView>

        <View style={{ flexDirection: 'row', gap: t.spacing.md, padding: t.spacing.lg, paddingTop: 0 }}>
          <View style={{ flex: 1 }}>
            <Button label={stepIdx === 0 ? 'Cancel' : 'Back'} variant="secondary" onPress={onBack} disabled={create.isPending} />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label={isLast ? (create.isPending ? 'Creating…' : 'Create') : 'Next'}
              onPress={onNext}
              loading={create.isPending}
              disabled={create.isPending}
            />
          </View>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
