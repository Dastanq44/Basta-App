import { useState } from 'react';
import { Alert } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { BottomSheet, BottomSheetMenuItem } from '@/shared/ui';
import { useI18n } from '@/shared/i18n';
import { useSession, useSignOut } from '@/features/auth';
import { useRequestAccountDeletion } from '@/features/moderation';
import { ProfileScreen } from '@/features/profile';

// Own Profile tab — thin wrapper around the shared <ProfileScreen> plus the settings BottomSheet
// (own-only). All layout/data lives in the feature; this file owns the account actions.
export default function ProfileTabScreen() {
  const router = useRouter();
  const { t: tr } = useI18n();
  const session = useSession();
  const signOut = useSignOut();
  const deletionRequest = useRequestAccountDeletion();
  const [menuOpen, setMenuOpen] = useState(false);
  const [deletionDone, setDeletionDone] = useState(false);
  const myUid = session.session?.user.id;

  const confirmDeletion = () => {
    setMenuOpen(false);
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
                Alert.alert('Could not request deletion', e instanceof Error ? e.message : 'Unknown error'),
            }),
        },
      ],
      { cancelable: true },
    );
  };

  const confirmSignOut = () => {
    setMenuOpen(false);
    Alert.alert('Sign out?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut.mutate() },
    ]);
  };

  if (!myUid) return null; // tabs render behind the auth gate; defensive only.

  return (
    <>
      <ProfileScreen userId={myUid} isOwn onOpenSettings={() => setMenuOpen(true)} />

      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
        <BottomSheetMenuItem
          label={tr('settings.editProfile')}
          onPress={() => {
            setMenuOpen(false);
            router.push('/profile/edit' as Href);
          }}
        />
        <BottomSheetMenuItem
          label={tr('settings.languageTheme')}
          onPress={() => {
            setMenuOpen(false);
            router.push('/profile/preferences' as Href);
          }}
        />
        <BottomSheetMenuItem
          label={tr('settings.blockedUsers')}
          onPress={() => {
            setMenuOpen(false);
            router.push('/blocked-users' as Href);
          }}
        />
        {deletionDone ? null : (
          <BottomSheetMenuItem
            label={deletionRequest.isPending ? 'Requesting…' : tr('settings.requestDeletion')}
            destructive
            onPress={confirmDeletion}
          />
        )}
        <BottomSheetMenuItem
          label={signOut.isPending ? 'Signing out…' : tr('settings.signOut')}
          destructive
          onPress={confirmSignOut}
        />
      </BottomSheet>
    </>
  );
}
