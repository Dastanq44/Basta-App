import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { Link, Stack, useRouter } from 'expo-router';
import { signUpInput, useSignUp } from '@/features/auth';
import { Button, Input, Screen, Text, useTheme } from '@/shared/ui';

export default function SignUpScreen() {
  const t = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const mutation = useSignUp();

  const onSubmit = () => {
    const parsed = signUpInput.safeParse({ email, password });
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
    mutation.mutate(parsed.data, {
      onSuccess: () => {
        router.replace({
          pathname: '/(auth)/verify-email',
          params: { email: parsed.data.email },
        });
      },
    });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Create account' }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, justifyContent: 'center', gap: t.spacing.lg }}>
          <Text variant="title">Create your account</Text>
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
            hint="At least 8 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password-new"
            textContentType="newPassword"
            error={fieldErrors.password}
            editable={!mutation.isPending}
          />
          {mutation.isError ? (
            <Text variant="caption" style={{ color: t.colors.destructive }}>
              {mutation.error instanceof Error ? mutation.error.message : 'Sign up failed.'}
            </Text>
          ) : null}
          <Button label="Create account" onPress={onSubmit} loading={mutation.isPending} />
          <Link href="/(auth)/sign-in">
            <Text variant="muted" style={{ textAlign: 'center' }}>
              Already have an account? Sign in
            </Text>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
