import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { resetPasswordInput, useUpdatePassword } from '@/features/auth';
import { Button, Input, Screen, Text, useTheme } from '@/shared/ui';
import { useI18n } from '@/shared/i18n';

// Reached via deep link from the Supabase reset email:
//   basta://reset-password?code=<recovery-code>
// We exchange the code for a recovery session, then accept the new password.
// If `code` is missing (manual navigation, deep link not configured), surface a clear error.
export default function ResetPasswordScreen() {
  const t = useTheme();
  const router = useRouter();
  const { t: tr } = useI18n();
  const params = useLocalSearchParams<{ code?: string }>();
  const code = params.code;
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const mutation = useUpdatePassword();

  const onSubmit = () => {
    if (password !== confirm) {
      setFieldError(tr('auth.passwordsNoMatch'));
      return;
    }
    const parsed = resetPasswordInput.safeParse({ password });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? tr('auth.strongerPassword'));
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
        <Stack.Screen options={{ title: tr('auth.resetTitle') }} />
        <View style={{ flex: 1, justifyContent: 'center', gap: t.spacing.lg }}>
          <Text variant="title">{tr('auth.openResetLink')}</Text>
          <Text variant="muted">{tr('auth.openResetLinkBody')}</Text>
          <Text variant="caption">{tr('auth.deepLinkHint')}</Text>
          <Link href="/(auth)/sign-in">
            <Text variant="muted" style={{ textAlign: 'center' }}>{tr('auth.backToSignIn')}</Text>
          </Link>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: tr('auth.newPasswordTitle') }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, justifyContent: 'center', gap: t.spacing.lg }}>
          <Text variant="title">{tr('auth.chooseNewPassword')}</Text>
          <Text variant="muted">{tr('auth.passwordHintDot')}</Text>

          <Input
            label={tr('auth.newPassword')}
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
            label={tr('auth.confirmPassword')}
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
              {mutation.error instanceof Error ? mutation.error.message : tr('auth.couldNotReset')}
            </Text>
          ) : null}

          <Button label={tr('auth.updatePassword')} onPress={onSubmit} loading={mutation.isPending} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
