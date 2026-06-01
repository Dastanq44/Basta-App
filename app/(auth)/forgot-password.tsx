import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { forgotPasswordInput, useRequestPasswordReset } from '@/features/auth';
import { Button, Input, Screen, Text, useTheme } from '@/shared/ui';

export default function ForgotPasswordScreen() {
  const t = useTheme();
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const mutation = useRequestPasswordReset();

  const onSubmit = () => {
    const parsed = forgotPasswordInput.safeParse({ email });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Enter a valid email');
      return;
    }
    setFieldError(undefined);
    mutation.mutate(parsed.data.email);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Reset password' }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, justifyContent: 'center', gap: t.spacing.lg }}>
          <Text variant="title">Forgot your password?</Text>
          <Text variant="muted">
            Enter the email you signed up with. We'll send a link to reset your password.
          </Text>

          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            error={fieldError}
            editable={!mutation.isPending && !mutation.isSuccess}
          />

          {mutation.isError ? (
            <Text variant="caption" style={{ color: t.colors.destructive }}>
              {mutation.error instanceof Error ? mutation.error.message : 'Could not send email.'}
            </Text>
          ) : null}

          {mutation.isSuccess ? (
            <Text variant="muted">
              Check your inbox. The email contains a link that opens the app on the reset
              screen. If nothing happens when you tap it, deep-link configuration on the project
              may still be pending — see W-020.
            </Text>
          ) : (
            <Button label="Send reset email" onPress={onSubmit} loading={mutation.isPending} />
          )}

          <Link href="/(auth)/sign-in">
            <Text variant="muted" style={{ textAlign: 'center' }}>
              Back to sign in
            </Text>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
