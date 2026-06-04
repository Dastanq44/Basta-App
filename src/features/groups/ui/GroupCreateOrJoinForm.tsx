import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, Input, Text, useTheme } from '@/shared/ui';
// Relative imports keep this free of a self-cycle once `index.ts` re-exports ui.
import { createGroupInput, INVITE_CODE_LENGTH, joinGroupInput } from '../model';
import { useCreateGroup, useJoinGroup } from '../hooks';

export type Mode = 'create' | 'join';

export type GroupCreateOrJoinFormProps = {
  /** Called after a successful create. Receives the new group id. */
  onCreated: (groupId: string) => void | Promise<void>;
  /** Called after a successful join. Receives the joined group id. */
  onJoined: (groupId: string) => void | Promise<void>;
  /** Optional initial mode (defaults to 'create'). */
  initialMode?: Mode;
  /** Optional extra header copy above the toggle (onboarding uses this to explain the step). */
  headerCopy?: string;
};

/**
 * Reusable create-or-join form. Owns local state + zod validation + RPC mutations,
 * but defers post-success behavior to the parent (onboarding completes onboarding then
 * routes to tabs; the main app invalidates queries then routes to the new group).
 *
 * Parent screens stay thin: they only wire callbacks and present the result.
 */
export function GroupCreateOrJoinForm({
  onCreated,
  onJoined,
  initialMode = 'create',
  headerCopy,
}: GroupCreateOrJoinFormProps) {
  const t = useTheme();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  const create = useCreateGroup();
  const join = useJoinGroup();
  const submitting = create.isPending || join.isPending;

  const activeError = mode === 'create' ? create.error : join.error;
  const submitError = activeError instanceof Error ? activeError.message : null;

  const onSubmit = async () => {
    setFieldError(null);
    if (mode === 'create') {
      const parsed = createGroupInput.safeParse({ name });
      if (!parsed.success) {
        setFieldError(parsed.error.issues[0]?.message ?? 'Invalid group name');
        return;
      }
      try {
        const group = await create.mutateAsync(parsed.data.name);
        await onCreated(group.id);
      } catch {
        /* surfaced via submitError */
      }
    } else {
      const parsed = joinGroupInput.safeParse({ code });
      if (!parsed.success) {
        setFieldError(parsed.error.issues[0]?.message ?? 'Invalid invite code');
        return;
      }
      try {
        const groupId = await join.mutateAsync(parsed.data.code);
        await onJoined(groupId);
      } catch {
        /* surfaced via submitError */
      }
    }
  };

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ gap: t.spacing.lg, paddingBottom: t.spacing.xl }}
    >
      {headerCopy ? <Text variant="muted">{headerCopy}</Text> : null}

      <ModeToggle mode={mode} onChange={setMode} />

      {mode === 'create' ? (
        <Input
          label="Group name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          placeholder="e.g. Morning runners"
          error={fieldError ?? undefined}
          editable={!submitting}
        />
      ) : (
        <Input
          label="Invite code"
          value={code}
          // Strip anything outside [A-Za-z0-9]; keep case (codes are case-sensitive).
          onChangeText={(v) => setCode(v.replace(/[^A-Za-z0-9]/g, '').slice(0, INVITE_CODE_LENGTH))}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          maxLength={INVITE_CODE_LENGTH}
          placeholder="12-character code"
          error={fieldError ?? undefined}
          editable={!submitting}
        />
      )}

      {submitError ? (
        <Text variant="caption" style={{ color: t.colors.destructive }}>
          {submitError}
        </Text>
      ) : null}

      <Button
        label={
          submitting
            ? mode === 'create'
              ? 'Creating…'
              : 'Joining…'
            : mode === 'create'
              ? 'Create group'
              : 'Join group'
        }
        onPress={onSubmit}
        loading={submitting}
        disabled={submitting}
      />
    </ScrollView>
  );
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const t = useTheme();
  const options: { value: Mode; label: string }[] = [
    { value: 'create', label: 'Create' },
    { value: 'join', label: 'Join with code' },
  ];
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: t.colors.muted,
        borderRadius: t.radius.md,
        padding: 4,
      }}
    >
      {options.map((o) => {
        const selected = o.value === mode;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: t.radius.md - 2,
              backgroundColor: selected ? t.colors.background : 'transparent',
              alignItems: 'center',
              minHeight: t.minTapTarget,
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                color: selected ? t.colors.foreground : t.colors.mutedForeground,
                fontWeight: '600',
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
