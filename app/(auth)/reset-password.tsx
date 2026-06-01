import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { resetPasswordInput, useUpdatePassword } from '@/features/auth';
import { Button, Input, Screen, Text, useTheme } from '@/shared/ui';

// Reached via deep link from the Supabase reset email:
//   basta://reset-password?code=<recovery-code>
// We exchange the code for a recovery session, then accept the new password.
// If `code` is missing (manual navigation, deep link not configured), surface a clear error.
export default function ResetPasswordScreen() {
  const t = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const code = params.code;
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const mutation = useUpdatePassword();

  const onSubmit = () => {
    if (password !== confirm) {
      setFieldError("Passwords don't match");
      return;
    }
    const parsed = resetPasswordInput.safeParse({ password });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Pick a stronger password');
      return;
    }
    setFieldError(undefined);
    mutation.mutate(
      { password: parsed.data.password, code },
      {
        onSuccess: () => {
          // After a successful reset Supabase already has us signed in via the recovery session.
          // The onboarding gate will route to (tabs); we don't have to navigate explicitly.
          // We just clear the route stack so the user can't go "back" to the reset screen.
          router.replace('/(tabs)');
        },
      },
    );
  };

  if (!code) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Reset password' }} />
        <View style={{ flex: 1, justifyContent: 'center', gap: t.spacing.lg }}>
          <Text variant="title">Open the reset link</Text>
          <Text variant="muted">
            Open the password-reset email on this phone and tap the link. It should open this
            screen with everything filled in.
          </Text>
          <Text variant="caption">
            If tapping the link does nothing, deep-link configuration on the Supabase project
            may not be set yet (W-020).
          </Text>
          <Link href="/(auth)/sign-in">
            <Text variant="muted" style={{ textAlign: 'center' }}>
              Back to sign in
            </Text>
          </Link>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'New password' }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, justifyContent: 'center', gap: t.spacing.lg }}>
          <Text variant="title">Choose a new password</Text>
          <Text variant="muted">At least 8 characters.</Text>

          <Input
            label="New password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password-new"
            textContentType="newPassword"
            editable={!mutation.isPending}
          />
          <Input
            label="Confirm password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password-new"
            textContentType="newPassword"
            error={fieldError}
            editable={!mutation.isPending}
          />

          {mutation.isError ? (
            <Text variant="caption" style={{ color: t.colors.destructive }}>
              {mutation.error instanceof Error ? mutation.error.message : 'Could not reset password.'}
            </Text>
          ) : null}

          <Button label="Update password" onPress={onSubmit} loading={mutation.isPending} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
