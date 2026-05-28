import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Input, Screen, Text, useTheme } from '@/shared/ui';
import {
  createGroupInput,
  joinGroupInput,
  useCreateGroup,
  useJoinGroup,
} from '@/features/groups';
import { useCompleteOnboarding } from '@/features/onboarding';

type Mode = 'create' | 'join';

export default function JoinOrCreateGroupScreen() {
  const t = useTheme();
  const [mode, setMode] = useState<Mode>('create');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  const create = useCreateGroup();
  const join = useJoinGroup();
  const complete = useCompleteOnboarding();

  const submitting = create.isPending || join.isPending || complete.isPending;

  // Show the most recent meaningful error from any of the three mutations.
  const activeError = mode === 'create' ? create.error : join.error;
  const submitError =
    activeError instanceof Error
      ? activeError.message
      : complete.error instanceof Error
        ? complete.error.message
        : null;

  const onSubmit = async () => {
    setFieldError(null);
    if (mode === 'create') {
      const parsed = createGroupInput.safeParse({ name });
      if (!parsed.success) {
        setFieldError(parsed.error.issues[0]?.message ?? 'Invalid group name');
        return;
      }
      try {
        await create.mutateAsync(parsed.data.name);
        await complete.mutateAsync();
        router.replace('/(tabs)');
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
        await join.mutateAsync(parsed.data.code);
        await complete.mutateAsync();
        router.replace('/(tabs)');
      } catch {
        /* surfaced via submitError */
      }
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <Screen>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: t.spacing.lg, paddingBottom: t.spacing.xl }}
        >
          <View style={{ gap: t.spacing.xs }}>
            <Text variant="title">Join or create a group</Text>
            <Text variant="muted">
              Friends keep each other honest. Start a new group or join one with an invite code.
            </Text>
          </View>

          <ModeToggle mode={mode} onChange={setMode} />

          {mode === 'create' ? (
            <Input
              label="Group name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              placeholder="e.g. Morning runners"
              error={fieldError ?? undefined}
            />
          ) : (
            <Input
              label="Invite code"
              value={code}
              onChangeText={setCode}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="paste your invite code"
              error={fieldError ?? undefined}
            />
          )}

          {submitError ? (
            <Text variant="caption" style={{ color: t.colors.destructive }}>
              {submitError}
            </Text>
          ) : null}

          <Button
            label={
              submitting ? (mode === 'create' ? 'Creating…' : 'Joining…') : mode === 'create' ? 'Create group' : 'Join group'
            }
            onPress={onSubmit}
            loading={submitting}
            disabled={submitting}
          />
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
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
            <Text style={{ color: selected ? t.colors.foreground : t.colors.mutedForeground, fontWeight: '600' }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
