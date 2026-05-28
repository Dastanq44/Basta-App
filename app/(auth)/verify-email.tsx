import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useVerifyOtp, verifyOtpInput } from '@/features/auth';
import { Button, Input, Screen, Text, useTheme } from '@/shared/ui';

// Email verification via 6-digit OTP delivered to the user's inbox.
// We never put the token in a URL (W-005) — user copies it from email body.
export default function VerifyEmailScreen() {
  const t = useTheme();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = params.email ?? '';
  const [token, setToken] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const mutation = useVerifyOtp();

  const onSubmit = () => {
    const parsed = verifyOtpInput.safeParse({ email, token });
    if (!parsed.success) {
      const tokenIssue = parsed.error.issues.find((i) => i.path[0] === 'token');
      setFieldError(tokenIssue?.message ?? 'Check the code and try again.');
      return;
    }
    setFieldError(undefined);
    mutation.mutate(parsed.data);
    // On success, supabase.auth fires onAuthStateChange → root layout redirects to (tabs).
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Verify email' }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, justifyContent: 'center', gap: t.spacing.lg }}>
          <Text variant="title">Check your email</Text>
          <Text variant="muted">
            We sent a 6-digit code to {email || 'your inbox'}. Enter it below to finish creating
            your account.
          </Text>
          <Input
            label="Verification code"
            value={token}
            onChangeText={(v) => setToken(v.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            error={fieldError}
            editable={!mutation.isPending}
          />
          {mutation.isError ? (
            <Text variant="caption" style={{ color: t.colors.destructive }}>
              {mutation.error instanceof Error ? mutation.error.message : 'Verification failed.'}
            </Text>
          ) : null}
          <Button label="Verify" onPress={onSubmit} loading={mutation.isPending} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
