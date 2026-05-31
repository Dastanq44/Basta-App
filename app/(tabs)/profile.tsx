import { View } from 'react-native';
import { Button, Card, Screen, Text, useTheme } from '@/shared/ui';
import { useSession, useSignOut } from '@/features/auth';

export default function ProfileScreen() {
  const t = useTheme();
  const session = useSession();
  const signOut = useSignOut();
  const email = session.session?.user.email;

  return (
    <Screen>
      <View style={{ gap: t.spacing.lg }}>
        <Text variant="title">Profile</Text>

        <Card>
          <View style={{ gap: t.spacing.xs }}>
            <Text variant="muted">Signed in as</Text>
            <Text variant="body">{email ?? '—'}</Text>
          </View>
        </Card>

        <Text variant="muted">Profile, settings, and account controls will live here.</Text>

        {/* Sign out → the onboarding gate sees `signedOut` and redirects to /(auth)/sign-in. */}
        <Button
          label="Sign out"
          variant="destructive"
          loading={signOut.isPending}
          onPress={() => signOut.mutate()}
        />
        {signOut.isError ? (
          <Text variant="caption" style={{ color: t.colors.destructive }}>
            {signOut.error instanceof Error ? signOut.error.message : 'Could not sign out.'}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
