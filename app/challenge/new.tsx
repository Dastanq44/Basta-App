import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
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
  VisibilityToggle,
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

type StepKey = 'type' | 'group' | 'category' | 'name' | 'icon' | 'start' | 'end' | 'desc' | 'visibility';
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

  // Decision steps (type / group / category) start UNSELECTED — no chip is highlighted until the
  // user actually taps one. (Preset-group entry still forces 'group'.)
  const [mode, setMode] = useState<'solo' | 'group' | null>(presetGroupId ? 'group' : null);
  const [groupId, setGroupId] = useState<string | null>(presetGroupId);
  const [category, setCategory] = useState<ChallengeCategory | null>(null);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('💪');
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(addDaysISO(todayISO(), 29));
  const [description, setDescription] = useState('');
  // Default visible/public (challenges show on the profile + Global unless the user hides them).
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stepIdx, setStepIdx] = useState(0);

  // Slide-transition state — see the renderer + useEffect below. `outgoingStep` holds the
  // KEY of the step being animated off-screen; null when no transition is in flight.
  const { width: screenWidth } = useWindowDimensions();
  const [outgoingStep, setOutgoingStep] = useState<StepKey | null>(null);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const slide = useRef(new Animated.Value(0)).current;

  // Step list rebuilds whenever mode / presetGroupId changes. The current step's KEY is
  // derived from this — we never index into a stale list because every render recomputes.
  const stepKeys: StepKey[] = useMemo(() => {
    if (presetGroupId) return ['category', 'name', 'icon', 'start', 'end', 'desc', 'visibility'];
    if (mode === 'group') return ['type', 'group', 'category', 'name', 'icon', 'start', 'end', 'desc', 'visibility'];
    return ['type', 'category', 'name', 'icon', 'start', 'end', 'desc', 'visibility'];
  }, [mode, presetGroupId]);

  const safeIdx = Math.min(stepIdx, stepKeys.length - 1);
  const step = stepKeys[safeIdx]!;
  const isLast = safeIdx === stepKeys.length - 1;
  // `isAutoAdvance` is computed per-step inside renderStepLayer, not here, since the
  // outgoing layer needs the same calculation for the step it's rendering.
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

  const advance = () => {
    setDirection('forward');
    setStepIdx((i) => Math.min(i + 1, stepKeys.length - 1));
  };

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
      isPublic,
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
    else {
      setDirection('back');
      setStepIdx(safeIdx - 1);
    }
  };

  // Drive the slide animation whenever the step prop changes. The previous step's KEY
  // gets parked in `outgoingStep` and we animate from 0→1; the layer style picks which
  // direction the moving layer translates (see the JSX below).
  const renderedStepRef = useRef<StepKey>(step);
  useEffect(() => {
    if (renderedStepRef.current === step) return;
    setOutgoingStep(renderedStepRef.current);
    renderedStepRef.current = step;
    slide.setValue(0);
    Animated.timing(slide, {
      toValue: 1,
      duration: 280,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setOutgoingStep(null);
    });
  }, [step, slide]);

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

  // ── Slide-transition setup. iOS-style mirror: forward = incoming slides in from the
  // right covering the outgoing; back = outgoing slides off to the right revealing the
  // incoming. The moving layer's translateX runs from off-screen to 0 (or 0 to off-screen),
  // driven by a single Animated.Value `slide` from 0..1. zIndex makes sure the layer
  // that should appear "on top" actually does, regardless of JSX order.
  const transitioning = outgoingStep !== null;
  const movingTranslateX = slide.interpolate({
    inputRange: [0, 1],
    outputRange: direction === 'forward' ? [screenWidth, 0] : [0, screenWidth],
  });

  const renderStepContent = (key: StepKey) => {
    switch (key) {
      case 'type':
        return (
          <View style={{ gap: t.spacing.md }}>
            <Text variant="heading">Solo or group?</Text>
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              <Chip label="Solo" selected={mode === 'solo'} onPress={() => onPickMode('solo')} />
              <Chip label="Group" selected={mode === 'group'} onPress={() => onPickMode('group')} />
            </View>
          </View>
        );
      case 'group':
        return (
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
        );
      case 'category':
        return (
          <View style={{ gap: t.spacing.md }}>
            <Text variant="heading">Pick a category</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
              {CHALLENGE_CATEGORIES.map((c) => (
                <Chip key={c} label={c} selected={category === c} onPress={() => onPickCategory(c)} />
              ))}
            </View>
          </View>
        );
      case 'name':
        return (
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
        );
      case 'icon':
        return (
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
        );
      case 'start':
        return (
          <View style={{ gap: t.spacing.md }}>
            <Text variant="heading">Start date</Text>
            {/* minDate=today disables past days; CalendarPicker also auto-hides the back
                arrow when the displayed view is at or before today's month. */}
            <CalendarPicker value={startDate} onChange={setStartDate} minDate={todayISO()} />
          </View>
        );
      case 'end': {
        const dayCount = diffDaysInclusive(startDate, endDate);
        return (
          <View style={{ gap: t.spacing.md }}>
            <Text variant="heading">End date</Text>
            <CalendarPicker
              value={endDate}
              onChange={setEndDate}
              minDate={startDate}
              maxDate={addDaysISO(startDate, 364)}
            />
            {dayCount != null ? (
              <View style={{ alignItems: 'center' }}>
                <View
                  style={{
                    paddingHorizontal: t.spacing.lg,
                    paddingVertical: t.spacing.sm,
                    borderRadius: t.radius.full,
                    backgroundColor: t.colors.primarySoft,
                    borderWidth: 1,
                    borderColor: t.colors.primary,
                  }}
                >
                  <Text
                    style={{
                      color: t.colors.primary,
                      fontWeight: '700',
                      fontSize: t.fontSize.lg,
                    }}
                  >
                    {dayCount} day challenge
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        );
      }
      case 'desc':
        return (
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
        );
      case 'visibility':
        return (
          <View style={{ gap: t.spacing.md }}>
            <Text variant="heading">Who can see this?</Text>
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
                title="Hide from profile and Global"
                description={
                  mode === 'group'
                    ? 'When hidden, this challenge is only visible to participants and its proofs will not appear in Global. Group challenge posts also require the group to be public.'
                    : 'When hidden, this challenge is only visible to participants and its proofs will not appear in Global.'
                }
                disabled={create.isPending}
              />
            </View>
          </View>
        );
    }
  };

  /** Each layer is the full step body inside its own ScrollView. The `isCurrent` layer
   *  shows the live error + the working Next button; the outgoing layer renders the
   *  step's content snapshot so the user sees what they're leaving behind. */
  const renderStepLayer = (key: StepKey, isCurrent: boolean) => {
    const lastForKey = stepKeys.indexOf(key) === stepKeys.length - 1;
    const autoForKey = AUTO_ADVANCE.has(key);
    return (
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.lg, paddingBottom: t.spacing.lg }}
      >
        {renderStepContent(key)}

        {isCurrent && error ? (
          <Text variant="caption" style={{ color: t.colors.destructive }}>
            {error}
          </Text>
        ) : null}
        {isCurrent && mutationError ? (
          <Text variant="caption" style={{ color: t.colors.destructive }}>
            {mutationError}
          </Text>
        ) : null}

        {!autoForKey ? (
          <Button
            label={lastForKey ? (create.isPending ? 'Creating…' : 'Create') : 'Next'}
            onPress={isCurrent ? onNext : () => {}}
            loading={isCurrent && create.isPending}
            disabled={create.isPending}
          />
        ) : null}
      </ScrollView>
    );
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Screen padded={false} edges={['bottom']}>
        <Stack.Screen options={{ title: 'New challenge' }} />
        <View style={{ paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.md }}>
          <ProgressBar value={progress} />
        </View>

        {/* Slide stage. During transitions, two absolutely-positioned layers overlap; the
            moving one carries the translateX animation, the stationary one sits at 0.
            When no transition is in flight, only the current layer renders, in normal flow.
            Each layer paints a solid `background` color so the incoming step fully obscures
            the outgoing's text/inputs as it slides in (otherwise the two layers' text
            visibly overlap during the ~280 ms animation — unpleasant on the eyes). */}
        <View style={{ flex: 1, overflow: 'hidden' }}>
          {transitioning && outgoingStep ? (
            <Animated.View
              pointerEvents="none"
              style={[
                ABSOLUTE_LAYER,
                { backgroundColor: t.colors.background },
                { zIndex: direction === 'back' ? 2 : 1 },
                direction === 'back' ? { transform: [{ translateX: movingTranslateX }] } : null,
              ]}
            >
              {renderStepLayer(outgoingStep, false)}
            </Animated.View>
          ) : null}

          <Animated.View
            style={[
              transitioning ? ABSOLUTE_LAYER : { flex: 1 },
              { backgroundColor: t.colors.background },
              transitioning ? { zIndex: direction === 'forward' ? 2 : 1 } : null,
              transitioning && direction === 'forward'
                ? { transform: [{ translateX: movingTranslateX }] }
                : null,
            ]}
          >
            {renderStepLayer(step, true)}
          </Animated.View>
        </View>

        {/* Cancel / Back stays as it was — at the bottom of the screen. Single slot:
            Cancel on step 0, Back otherwise. NOT animated. */}
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

const ABSOLUTE_LAYER = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };
