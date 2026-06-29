import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  CATEGORY_EMOJI_SECTION,
  CHALLENGE_CATEGORIES,
  EMOJI_SUGGESTIONS,
  createChallengeInput,
  useCreateChallenge,
  type ChallengeCategory,
} from '@/features/challenges';
import { useMyGroups } from '@/features/groups';
import { EmojiPickerSheet } from '@/features/social';
import {
  Button,
  CalendarPicker,
  Chip,
  Icon,
  Input,
  ProgressBar,
  Screen,
  Text,
  useTheme,
  VisibilityToggle,
} from '@/shared/ui';
import { useI18n, type I18nKey } from '@/shared/i18n';

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
  const { t: tr } = useI18n();
  const create = useCreateChallenge();
  const groups = useMyGroups();
  const params = useLocalSearchParams<{ groupId?: string }>();
  const presetGroupId = typeof params.groupId === 'string' ? params.groupId : null;
  const [pickerOpen, setPickerOpen] = useState(false);

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
          setError(tr('wizard.errPickGroup'));
          return false;
        }
        return true;
      case 'name':
        if (name.trim().length === 0) {
          setError(tr('wizard.errName'));
          return false;
        }
        return true;
      case 'start':
        if (!isISO(startDate)) {
          setError(tr('wizard.errStart'));
          return false;
        }
        return true;
      case 'end': {
        const days = diffDaysInclusive(startDate, endDate);
        if (days == null) {
          setError(tr('wizard.errEnd'));
          return false;
        }
        if (days < 1) {
          setError(tr('wizard.errEndAfter'));
          return false;
        }
        if (days > 365) {
          setError(tr('wizard.errMax365'));
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
      setError(parsed.error.issues[0]?.message ?? tr('wizard.errCheck'));
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
            <Text variant="heading">{tr('wizard.type.title')}</Text>
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              <Chip label={tr('wizard.solo')} selected={mode === 'solo'} onPress={() => onPickMode('solo')} />
              <Chip label={tr('wizard.group')} selected={mode === 'group'} onPress={() => onPickMode('group')} />
            </View>
          </View>
        );
      case 'group':
        return (
          <View style={{ gap: t.spacing.md }}>
            <Text variant="heading">{tr('wizard.group.title')}</Text>
            {groups.isPending ? (
              <Text variant="muted">{tr('wizard.loadingGroups')}</Text>
            ) : !groups.data || groups.data.length === 0 ? (
              <Text variant="muted">{tr('wizard.noGroups')}</Text>
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
            <Text variant="heading">{tr('wizard.category.title')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
              {CHALLENGE_CATEGORIES.map((c) => (
                <Chip key={c} label={tr(`category.${c}` as I18nKey)} selected={category === c} onPress={() => onPickCategory(c)} />
              ))}
            </View>
          </View>
        );
      case 'name':
        return (
          <View style={{ gap: t.spacing.md }}>
            <Text variant="heading">{tr('wizard.name.title')}</Text>
            <Input
              label={tr('challenge.nameLabel')}
              value={name}
              onChangeText={setName}
              placeholder={tr('challenge.namePlaceholder')}
              autoCapitalize="sentences"
              editable={!create.isPending}
            />
          </View>
        );
      case 'icon': {
        // Suggestions are driven by the chosen category (falls back to "other").
        const suggestions = EMOJI_SUGGESTIONS[category ?? 'other'];
        return (
          <View style={{ gap: t.spacing.lg }}>
            <Text variant="heading">{tr('wizard.icon.title')}</Text>
            {/* Large preview. */}
            <View style={{ alignItems: 'center' }}>
              <View
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 30,
                  backgroundColor: t.colors.primarySoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 48, lineHeight: 60, textAlign: 'center' }}>{emoji || '🙂'}</Text>
              </View>
            </View>
            {/* Suggested set for this category — a single tidy row, not a wall of emoji. */}
            <View style={{ gap: t.spacing.sm }}>
              <Text variant="label">{tr('wizard.icon.suggested').toUpperCase()}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
                {suggestions.map((e) => (
                  <Pressable
                    key={e}
                    accessibilityRole="button"
                    accessibilityLabel={e}
                    onPress={() => setEmoji(e)}
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: t.radius.md,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: emoji === e ? t.colors.primarySoft : t.colors.muted,
                      borderWidth: emoji === e ? 1.5 : 0,
                      borderColor: t.colors.primary,
                    }}
                  >
                    <Text style={{ fontSize: 28, lineHeight: 36, textAlign: 'center' }}>{e}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            {/* Full picker — the single path to every other emoji (search + categories). */}
            <Button
              label={tr('wizard.icon.browseAll')}
              variant="secondary"
              icon={<Icon name="search" size={16} color={t.colors.foreground} />}
              onPress={() => setPickerOpen(true)}
            />
          </View>
        );
      }
      case 'start':
        return (
          <View style={{ gap: t.spacing.md }}>
            <Text variant="heading">{tr('wizard.start.title')}</Text>
            {/* minDate=today disables past days; CalendarPicker also auto-hides the back
                arrow when the displayed view is at or before today's month. */}
            <CalendarPicker value={startDate} onChange={setStartDate} minDate={todayISO()} />
          </View>
        );
      case 'end': {
        const dayCount = diffDaysInclusive(startDate, endDate);
        return (
          <View style={{ gap: t.spacing.md }}>
            <Text variant="heading">{tr('wizard.end.title')}</Text>
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
              {tr('wizard.descLabel')}
              <Text style={{ color: t.colors.mutedForeground, fontWeight: '400' }}>
                {' '}({tr('common.optional')})
              </Text>
            </Text>
            <Input
              label={tr('wizard.descInputLabel')}
              value={description}
              onChangeText={setDescription}
              placeholder={tr('wizard.descPlaceholder')}
              multiline
              maxLength={280}
              editable={!create.isPending}
            />
          </View>
        );
      case 'visibility':
        return (
          <View style={{ gap: t.spacing.md }}>
            <Text variant="heading">{tr('wizard.visibilityTitle')}</Text>
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
                title={tr('wizard.hideTitle')}
                description={mode === 'group' ? tr('wizard.hideDescGroup') : tr('wizard.hideDescSolo')}
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
            label={lastForKey ? (create.isPending ? tr('wizard.creating') : tr('wizard.create')) : tr('wizard.next')}
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
        <Stack.Screen options={{ title: tr('today.newChallenge') }} />
        <View style={{ paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.md, gap: t.spacing.sm }}>
          <StepIndicator total={stepKeys.length} current={safeIdx} />
          <ProgressBar value={progress} height={6} />
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
            label={safeIdx === 0 ? tr('common.cancel') : tr('common.back')}
            variant="secondary"
            onPress={onBack}
            disabled={create.isPending}
          />
        </View>

        {/* Shared emoji picker — the single "browse all" surface for the icon step. Opens jumped
            to the category most relevant to the chosen challenge category. */}
        <EmojiPickerSheet
          visible={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelect={(e) => {
            setEmoji(e);
            setPickerOpen(false);
          }}
          initialCategoryKey={CATEGORY_EMOJI_SECTION[category ?? 'other']}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const ABSOLUTE_LAYER = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };

/** Subtle steppe-style step indicator: completed steps are filled dots, the current step is a
 *  small rotated diamond (qoshqar-müyiz nod), upcoming steps are hollow. Pure ornament, a11y-hidden
 *  (the ProgressBar below conveys progress; this is decorative reinforcement). */
function StepIndicator({ total, current }: { total: number; current: number }) {
  const t = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }}
    >
      {Array.from({ length: total }).map((_, i) => {
        if (i === current) {
          return (
            <View
              key={i}
              style={{ width: 9, height: 9, backgroundColor: t.colors.primary, transform: [{ rotate: '45deg' }] }}
            />
          );
        }
        const done = i < current;
        return (
          <View
            key={i}
            style={{
              width: 7,
              height: 7,
              borderRadius: 3.5,
              backgroundColor: done ? t.colors.primary : 'transparent',
              borderWidth: done ? 0 : 1.5,
              borderColor: t.colors.border,
            }}
          />
        );
      })}
    </View>
  );
}
