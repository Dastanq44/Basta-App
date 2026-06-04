import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { Avatar, Button, Card, Screen, SegmentedControl, Text, useTheme, useThemeMode } from '@/shared/ui';
import { useSession, useSignOut } from '@/features/auth';
import { useRequestAccountDeletion } from '@/features/moderation';

export default function ProfileScreen() {
  const t = useTheme();
  const { mode, setMode } = useThemeMode();
  const router = useRouter();
  const session = useSession();
  const signOut = useSignOut();
  const deletionRequest = useRequestAccountDeletion();
  const email = session.session?.user.email;
  const [deletionDone, setDeletionDone] = useState(false);

  // Two-step destructive confirm. After success the user can optionally sign out so they
  // can't keep using the app while their request sits in the moderation queue.
  const confirmDeletion = () => {
    Alert.alert(
      'Request account deletion?',
      'This marks your account for deletion. Your data will be removed by an admin process. ' +
        'This is irreversible — sign in again only if you change your mind before processing.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request deletion',
          style: 'destructive',
          onPress: () =>
            deletionRequest.mutate(undefined, {
              onSuccess: () => {
                setDeletionDone(true);
                Alert.alert(
                  'Deletion requested',
                  'Your request is in the queue. You can sign out now or stay signed in.',
                  [
                    { text: 'Stay signed in', style: 'cancel' },
                    { text: 'Sign out', style: 'destructive', onPress: () => signOut.mutate() },
                  ],
                );
              },
              onError: (e: unknown) =>
                Alert.alert(
                  'Could not request deletion',
                  e instanceof Error ? e.message : 'Unknown error',
                ),
            }),
        },
      ],
      { cancelable: true },
    );
  };

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={{
          padding: t.spacing.lg,
          gap: t.spacing.lg,
          paddingBottom: t.spacing.xl,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
          <Avatar name={email ?? 'U'} size={64} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="title">Profile</Text>
            <Text variant="muted" numberOfLines={1}>
              {email ?? '—'}
            </Text>
          </View>
        </View>

        <View style={{ gap: t.spacing.sm }}>
          <Text variant="heading">Appearance</Text>
          <SegmentedControl
            options={
              [
                { label: 'System', value: 'system' },
                { label: 'Light', value: 'light' },
                { label: 'Dark', value: 'dark' },
              ] as const
            }
            value={mode}
            onChange={setMode}
          />
          <Text variant="caption">
            Choose light or dark, or follow your device. Saved on this device only.
          </Text>
        </View>

        <View style={{ gap: t.spacing.sm }}>
          <Text variant="heading">Account</Text>
          {/* typedRoutes hasn't generated /blocked-users yet; cast the href. */}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/blocked-users' as Href)}
            hitSlop={4}
          >
            <Card>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text variant="body">Blocked users</Text>
                <Text variant="muted">›</Text>
              </View>
            </Card>
          </Pressable>
        </View>

        <View style={{ gap: t.spacing.sm }}>
          <Text variant="heading">Danger zone</Text>
          {deletionDone ? (
            <Card>
              <Text variant="body">Account deletion requested.</Text>
              <Text variant="muted">
                Your request is in the moderation queue. You can stay signed in or sign out
                below.
              </Text>
            </Card>
          ) : (
            <Button
              label={deletionRequest.isPending ? 'Requesting…' : 'Request account deletion'}
              variant="destructive"
              loading={deletionRequest.isPending}
              disabled={deletionRequest.isPending}
              onPress={confirmDeletion}
            />
          )}
          {deletionRequest.isError ? (
            <Text variant="caption" style={{ color: t.colors.destructive }}>
              {deletionRequest.error instanceof Error
                ? deletionRequest.error.message
                : 'Could not request deletion.'}
            </Text>
          ) : null}
        </View>

        <View style={{ gap: t.spacing.sm }}>
          <Button
            label="Sign out"
            variant="secondary"
            loading={signOut.isPending}
            onPress={() => signOut.mutate()}
          />
          {signOut.isError ? (
            <Text variant="caption" style={{ color: t.colors.destructive }}>
              {signOut.error instanceof Error ? signOut.error.message : 'Could not sign out.'}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}
