import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { forgotPasswordInput, useRequestPasswordReset } from '@/features/auth';
import { Button, Input, Screen, Text, useTheme } from '@/shared/ui';
import { useI18n } from '@/shared/i18n';

export default function ForgotPasswordScreen() {
  const t = useTheme();
  const { t: tr } = useI18n();
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const mutation = useRequestPasswordReset();

  const onSubmit = () => {
    const parsed = forgotPasswordInput.safeParse({ email });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? tr('auth.invalidEmail'));
      return;
    }
    setFieldError(undefined);
    mutation.mutate(parsed.data.email);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: tr('auth.resetTitle') }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, justifyContent: 'center', gap: t.spacing.lg }}>
          <Text variant="title">{tr('auth.forgotQ')}</Text>
          <Text variant="muted">{tr('auth.forgotBodyLong')}</Text>

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
            error={fieldError}
            editable={!mutation.isPending}
          />

          {mutation.isError ? (
            <Text variant="caption" style={{ color: t.colors.destructive }}>
              {mutation.error instanceof Error ? mutation.error.message : tr('auth.couldNotSend')}
            </Text>
          ) : null}

          {mutation.isSuccess ? (
            <Text variant="muted">{tr('auth.resetEmailSentBody')}</Text>
          ) : null}

          <Button
            label={
              mutation.isPending
                ? tr('auth.sending')
                : mutation.isSuccess
                  ? tr('auth.resendEmail')
                  : tr('auth.sendResetEmail')
            }
            onPress={onSubmit}
            loading={mutation.isPending}
            variant={mutation.isSuccess ? 'secondary' : 'primary'}
          />

          <Link href="/(auth)/sign-in">
            <Text variant="muted" style={{ textAlign: 'center' }}>{tr('auth.backToSignIn')}</Text>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
