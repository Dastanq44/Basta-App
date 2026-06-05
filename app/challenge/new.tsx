import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  CHALLENGE_CATEGORIES,
  createChallengeInput,
  useCreateChallenge,
  type ChallengeCategory,
} from '@/features/challenges';
import { useMyGroups } from '@/features/groups';
import {
  Button,
  CalendarPicker,
  Chip,
  Input,
  ProgressBar,
  Screen,
  Text,
  useTheme,
} from '@/shared/ui';

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

type StepKey = 'type' | 'group' | 'category' | 'name' | 'icon' | 'start' | 'end' | 'desc';
/** Steps where picking a value auto-advances — no Next button needed. The user's spec:
 *  "Make the decisions (solo/group, which group, category) so that when you choose them
 *  it automatically goes to next step." Other steps require an explicit Next. */
const AUTO_ADVANCE: ReadonlySet<StepKey> = new Set(['type', 'group', 'category']);

// Step-by-step new-challenge wizard. Dynamic step list: solo skips the 'group' step;
// presetGroupId (e.g. "+" from inside a group) skips both 'type' and 'group'.
//   solo:   [type, category, name, icon, start, end, desc]
//   group:  [type, group, category, name, icon, start, end, desc]
//   preset: [category, name, icon, start, end, desc]
// No migration: emoji is prefixed onto the title; start+end → duration_days; description
// → existing proof_requirement column.
export default function CreateChallengeScreen() {
  const t = useTheme();
  const router = useRouter();
  const create = useCreateChallenge();
  const groups = useMyGroups();
  const params = useLocalSearchParams<{ groupId?: string }>();
  const presetGroupId = typeof params.groupId === 'string' ? params.groupId : null;

  const [mode, setMode] = useState<'solo' | 'group'>(presetGroupId ? 'group' : 'solo');
  const [groupId, setGroupId] = useState<string | null>(presetGroupId);
  const [category, setCategory] = useState<ChallengeCategory>('fitness');
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('💪');
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(addDaysISO(todayISO(), 29));
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [stepIdx, setStepIdx] = useState(0);

  // Step list rebuilds whenever mode / presetGroupId changes. The current step's KEY is
  // derived from this — we never index into a stale list because every render recomputes.
  const stepKeys: StepKey[] = useMemo(() => {
    if (presetGroupId) return ['category', 'name', 'icon', 'start', 'end', 'desc'];
    if (mode === 'group') return ['type', 'group', 'category', 'name', 'icon', 'start', 'end', 'desc'];
    return ['type', 'category', 'name', 'icon', 'start', 'end', 'desc'];
  }, [mode, presetGroupId]);

  const safeIdx = Math.min(stepIdx, stepKeys.length - 1);
  const step = stepKeys[safeIdx]!;
  const isLast = safeIdx === stepKeys.length - 1;
  const isAutoAdvance = AUTO_ADVANCE.has(step);
  const mutationError = create.error instanceof Error ? create.error.message : null;

  const validateStep = (target: StepKey): boolean => {
    setError(null);
    switch (target) {
      case 'group':
        if (!groupId) {
          setError('Pick a group');
          return false;
        }
        return true;
      case 'name':
        if (name.trim().length === 0) {
          setError('Give your challenge a name');
          return false;
        }
        return true;
      case 'start':
        if (!isISO(startDate)) {
          setError('Pick a start date');
          return false;
        }
        return true;
      case 'end': {
        const days = diffDaysInclusive(startDate, endDate);
        if (days == null) {
          setError('Pick an end date');
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
        return true;
      }
      default:
        return true;
    }
  };

  const advance = () => setStepIdx((i) => Math.min(i + 1, stepKeys.length - 1));

  const onNext = async () => {
    if (!validateStep(step)) return;
    if (!isLast) {
      advance();
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
    if (safeIdx === 0) router.back();
    else setStepIdx(safeIdx - 1);
  };

  // Auto-advance handlers — selection on these steps immediately moves to the next.
  const onPickMode = (m: 'solo' | 'group') => {
    setMode(m);
    if (m === 'solo') setGroupId(null);
    setError(null);
    advance();
  };
  const onPickGroup = (gid: string) => {
    setGroupId(gid);
    setError(null);
    advance();
  };
  const onPickCategory = (c: ChallengeCategory) => {
    setCategory(c);
    setError(null);
    advance();
  };

  // Progress bar starts EMPTY at step 0 and fills to FULL once the final step is reached.
  // No "Step n of n" label per the spec.
  const progress = stepKeys.length > 1 ? safeIdx / (stepKeys.length - 1) : 0;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Screen padded={false} edges={['bottom']}>
        <Stack.Screen options={{ title: 'New challenge' }} />
        <View style={{ paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.md }}>
          <ProgressBar value={progress} />
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.lg, paddingBottom: t.spacing.lg }}
        >
          {step === 'type' ? (
            <View style={{ gap: t.spacing.md }}>
              <Text variant="heading">Solo or group?</Text>
              <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
                <Chip label="Solo" selected={mode === 'solo'} onPress={() => onPickMode('solo')} />
                <Chip label="Group" selected={mode === 'group'} onPress={() => onPickMode('group')} />
              </View>
            </View>
          ) : step === 'group' ? (
            <View style={{ gap: t.spacing.md }}>
              <Text variant="heading">Which group?</Text>
              {groups.isPending ? (
                <Text variant="muted">Loading groups…</Text>
              ) : !groups.data || groups.data.length === 0 ? (
                <Text variant="muted">You&apos;re not in a group yet. Create or join one first.</Text>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
                  {groups.data.map((g) => (
                    <Chip
                      key={g.id}
                      label={g.name}
                      selected={groupId === g.id}
                      onPress={() => onPickGroup(g.id)}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : step === 'category' ? (
            <View style={{ gap: t.spacing.md }}>
              <Text variant="heading">Pick a category</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
                {CHALLENGE_CATEGORIES.map((c) => (
                  <Chip key={c} label={c} selected={category === c} onPress={() => onPickCategory(c)} />
                ))}
              </View>
            </View>
          ) : step === 'name' ? (
            <View style={{ gap: t.spacing.md }}>
              <Text variant="heading">Name your challenge</Text>
              <Input
                label="Name"
                value={name}
                onChangeText={setName}
                placeholder="e.g. Morning run"
                autoCapitalize="sentences"
                editable={!create.isPending}
              />
            </View>
          ) : step === 'icon' ? (
            <View style={{ gap: t.spacing.md }}>
              <Text variant="heading">Pick an icon</Text>
              <View style={{ alignItems: 'center', gap: t.spacing.xs }}>
                <View
                  style={{
                    width: 88,
                    height: 88,
                    borderRadius: 28,
                    backgroundColor: t.colors.primarySoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      // Larger lineHeight + textAlignVertical: 'center' prevent the top of
                      // taller emojis (e.g. 🏋️, 🚭, 🎸) from being clipped by the box.
                      fontSize: 44,
                      lineHeight: 56,
                      textAlign: 'center',
                      textAlignVertical: 'center',
                    }}
                  >
                    {emoji || '🙂'}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm, justifyContent: 'center' }}>
                {EMOJIS.map((e) => (
                  <Pressable
                    key={e}
                    accessibilityRole="button"
                    onPress={() => setEmoji(e)}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: t.radius.md,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: emoji === e ? t.colors.primarySoft : t.colors.muted,
                      borderWidth: emoji === e ? 1.5 : 0,
                      borderColor: t.colors.primary,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 26,
                        lineHeight: 34,
                        textAlign: 'center',
                        textAlignVertical: 'center',
                      }}
                    >
                      {e}
                    </Text>
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
            </View>
          ) : step === 'start' ? (
            <View style={{ gap: t.spacing.md }}>
              <Text variant="heading">Start date</Text>
              <CalendarPicker value={startDate} onChange={setStartDate} />
            </View>
          ) : step === 'end' ? (
            <View style={{ gap: t.spacing.md }}>
              <Text variant="heading">End date</Text>
              <CalendarPicker
                value={endDate}
                onChange={setEndDate}
                minDate={startDate}
                maxDate={addDaysISO(startDate, 364)}
              />
              {diffDaysInclusive(startDate, endDate) != null ? (
                <Text variant="muted" style={{ textAlign: 'center' }}>
                  {diffDaysInclusive(startDate, endDate)} day challenge
                </Text>
              ) : null}
            </View>
          ) : (
            <View style={{ gap: t.spacing.md }}>
              {/* "(optional)" rendered inline, non-bold, muted color to match the spec. */}
              <Text variant="heading">
                Description
                <Text style={{ color: t.colors.mutedForeground, fontWeight: '400' }}>
                  {' '}(optional)
                </Text>
              </Text>
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

          {/* Next / Create — full-width on its own line, INSIDE the ScrollView right below
              the step inputs. Auto-advance steps don't render it (selection advances on tap). */}
          {!isAutoAdvance ? (
            <Button
              label={isLast ? (create.isPending ? 'Creating…' : 'Create') : 'Next'}
              onPress={onNext}
              loading={create.isPending}
              disabled={create.isPending}
            />
          ) : null}
        </ScrollView>

        {/* Cancel / Back stays as it was — at the bottom of the screen. Single slot:
            Cancel on step 0, Back otherwise. */}
        <View style={{ padding: t.spacing.lg, paddingTop: 0 }}>
          <Button
            label={safeIdx === 0 ? 'Cancel' : 'Back'}
            variant="secondary"
            onPress={onBack}
            disabled={create.isPending}
          />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
