import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { type Href, Link, Stack } from 'expo-router';
import { signInInput, useSignIn } from '@/features/auth';
import { Button, Input, OrnamentDivider, OrnamentMedallion, Screen, Text, useTheme } from '@/shared/ui';
import { useI18n } from '@/shared/i18n';

export default function SignInScreen() {
  const t = useTheme();
  const { t: tr } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const mutation = useSignIn();

  const onSubmit = () => {
    const parsed = signInInput.safeParse({ email, password });
    if (!parsed.success) {
      const errs: typeof fieldErrors = {};
      parsed.error.issues.forEach((i) => {
        const path = i.path[0];
        if (path === 'email') errs.email = i.message;
        if (path === 'password') errs.password = i.message;
      });
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    mutation.mutate(parsed.data);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Sign in' }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, justifyContent: 'center', gap: t.spacing.lg }}>
          {/* Branded hero — medallion + wordmark + ornament band. */}
          <View style={{ alignItems: 'center', gap: t.spacing.sm }}>
            <OrnamentMedallion size={72} />
            <Text variant="title" style={{ textAlign: 'center' }}>{tr('auth.welcome')}</Text>
            <Text variant="muted" style={{ textAlign: 'center' }}>{tr('auth.tagline')}</Text>
            <OrnamentDivider style={{ alignSelf: 'stretch', marginTop: t.spacing.xs }} />
          </View>
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
            error={fieldErrors.email}
            editable={!mutation.isPending}
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            textContentType="password"
            error={fieldErrors.password}
            editable={!mutation.isPending}
          />
          {mutation.isError ? (
            <Text variant="caption" style={{ color: t.colors.destructive }}>
              {mutation.error instanceof Error ? mutation.error.message : 'Sign in failed.'}
            </Text>
          ) : null}
          <Button label={tr('auth.signIn')} onPress={onSubmit} loading={mutation.isPending} />
          {/* typedRoutes hasn't generated the new (auth)/forgot-password path in the route
              union yet; the resolved string href is what expo-router navigates with. */}
          <Link href={'/(auth)/forgot-password' as Href}>
            <Text variant="muted" style={{ textAlign: 'center' }}>
              Forgot password?
            </Text>
          </Link>
          <Link href="/(auth)/sign-up">
            <Text variant="muted" style={{ textAlign: 'center' }}>
              Don't have an account? Sign up
            </Text>
          </Link>
          <Link href="/(auth)/verify-email">
            <Text variant="muted" style={{ textAlign: 'center' }}>
              Have a verification code? Verify your email
            </Text>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
