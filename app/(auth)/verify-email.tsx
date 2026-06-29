import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { OTP_MAX_LENGTH, useVerifyOtp, verifyOtpInput } from '@/features/auth';
import { Button, Input, Screen, Text, useTheme } from '@/shared/ui';
import { useI18n } from '@/shared/i18n';

// Email verification via OTP code delivered to the user's inbox.
// We never put the token in a URL (W-005) — user copies it from the email body.
//
// Two entry paths:
//   1) Forwarded from sign-up with `email` as a query param (happy path).
//   2) Direct navigation (e.g. user closed the app mid-signup and is now stuck on the
//      "Email rate limit exceeded" wall on sign-up). In that case we show an email field
//      too so they can verify a previously-sent code without re-sending.
export default function VerifyEmailScreen() {
  const t = useTheme();
  const { t: tr } = useI18n();
  const params = useLocalSearchParams<{ email?: string }>();
  const emailFromParam = !!params.email;
  const [email, setEmail] = useState(params.email ?? '');
  const [token, setToken] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; token?: string }>({});
  const mutation = useVerifyOtp();

  const onSubmit = () => {
    const parsed = verifyOtpInput.safeParse({ email, token });
    if (!parsed.success) {
      const errs: { email?: string; token?: string } = {};
      parsed.error.issues.forEach((i) => {
        const path = i.path[0];
        if (path === 'email') errs.email = i.message;
        if (path === 'token') errs.token = i.message;
      });
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    mutation.mutate(parsed.data);
    // On success, supabase.auth fires onAuthStateChange → root layout redirects via the gate.
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: tr('auth.verifyEmailTitle') }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, justifyContent: 'center', gap: t.spacing.lg }}>
          <Text variant="title">{tr('auth.checkEmail')}</Text>
          <Text variant="muted">
            {emailFromParam
              ? tr('auth.verifyEmailBodyParam', { email })
              : tr('auth.verifyEmailBodyNoParam')}
          </Text>

          {emailFromParam ? null : (
            <Input
              label={tr('auth.email')}
              value={email}
              onChangeText={setEmail}
              placeholder={tr('auth.emailPlaceholder')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              error={fieldErrors.email}
              editable={!mutation.isPending}
            />
          )}

          <Input
            label={tr('auth.code')}
            value={token}
            onChangeText={(v) => setToken(v.replace(/\D/g, '').slice(0, OTP_MAX_LENGTH))}
            placeholder={tr('auth.codePlaceholder')}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={OTP_MAX_LENGTH}
            error={fieldErrors.token}
            editable={!mutation.isPending}
          />
          {mutation.isError ? (
            <Text variant="caption" style={{ color: t.colors.destructive }}>
              {mutation.error instanceof Error ? mutation.error.message : tr('auth.verifyFailed')}
            </Text>
          ) : null}
          <Button label={tr('auth.verify')} onPress={onSubmit} loading={mutation.isPending} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
