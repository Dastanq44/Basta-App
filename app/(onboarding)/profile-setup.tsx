import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { ZodError } from 'zod';
import { Button, Input, Screen, Text, useTheme } from '@/shared/ui';
import {
  CURRENT_TERMS_VERSION,
  profileSetupInput,
  useProfile,
  useUpsertProfile,
} from '@/features/onboarding';

// Thin route — composition + navigation only. Validation/zod, mutation, mapping all live
// in the onboarding feature.

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

type FieldErrors = Partial<Record<'username' | 'displayName' | 'acceptedTerms', string>>;

export default function ProfileSetupScreen() {
  const t = useTheme();
  const profile = useProfile();
  const upsert = useUpsertProfile();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  // Prefill from any existing profile (e.g. terms-bump re-entry).
  useEffect(() => {
    if (profile.data) {
      setUsername(profile.data.username);
      setDisplayName(profile.data.displayName);
      setAccepted(profile.data.termsVersion === CURRENT_TERMS_VERSION);
    }
  }, [profile.data]);

  const submitting = upsert.isPending;
  const supabaseError = upsert.error instanceof Error ? upsert.error.message : null;

  const onSubmit = async () => {
    setErrors({});
    const parsed = profileSetupInput.safeParse({
      username,
      displayName,
      timezone: detectTimezone(),
      acceptedTerms: accepted,
    });
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      return;
    }
    try {
      await upsert.mutateAsync({
        username: parsed.data.username,
        displayName: parsed.data.displayName,
        timezone: parsed.data.timezone,
        termsVersion: CURRENT_TERMS_VERSION,
      });
      router.replace('/(onboarding)/join-or-create-group');
    } catch {
      // surfaced via `upsert.error` -> supabaseError below
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
            <Text variant="title">Set up your profile</Text>
            <Text variant="muted">
              Pick a username and a display name. You can change the display name later.
            </Text>
          </View>

          <Input
            label="Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username-new"
            textContentType="username"
            placeholder="e.g. dastan42"
            error={errors.username}
            hint={errors.username ? undefined : '3–30 letters, digits, or underscores'}
          />

          <Input
            label="Display name"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            autoCorrect
            placeholder="e.g. Дастан"
            error={errors.displayName}
          />

          <TermsCheckbox
            checked={accepted}
            onToggle={() => setAccepted((v) => !v)}
            error={errors.acceptedTerms}
          />

          {supabaseError ? (
            <Text variant="caption" style={{ color: t.colors.destructive }}>
              {supabaseError}
            </Text>
          ) : null}

          <Button
            label={submitting ? 'Saving…' : 'Continue'}
            onPress={onSubmit}
            loading={submitting}
            disabled={submitting}
          />
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}

function TermsCheckbox({
  checked,
  onToggle,
  error,
}: {
  checked: boolean;
  onToggle: () => void;
  error?: string;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: t.spacing.xs }}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        onPress={onToggle}
        hitSlop={8}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.spacing.md,
          minHeight: t.minTapTarget,
        }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: t.radius.sm,
            borderWidth: 1.5,
            borderColor: checked ? t.colors.primary : t.colors.border,
            backgroundColor: checked ? t.colors.primary : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {checked ? (
            <Text style={{ color: t.colors.primaryForeground, fontWeight: '700' }}>✓</Text>
          ) : null}
        </View>
        <Text variant="body" style={{ flex: 1 }}>
          I accept the Terms of Service and Privacy Policy
        </Text>
      </Pressable>
      {error ? (
        <Text variant="caption" style={{ color: t.colors.destructive }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

function toFieldErrors(err: ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of err.issues) {
    const k = issue.path[0];
    if (k === 'username' || k === 'displayName' || k === 'acceptedTerms') {
      if (!out[k]) out[k] = issue.message;
    }
  }
  return out;
}
