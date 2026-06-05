import { useMemo, useState } from 'react';
import { Alert, FlatList, Image, Pressable, ScrollView, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import {
  Avatar,
  BottomSheet,
  BottomSheetMenuItem,
  Card,
  Icon,
  Screen,
  SegmentedControl,
  Text,
  useTheme,
} from '@/shared/ui';
import { useSession, useSignOut } from '@/features/auth';
import { useProfile, userAvatarUrl } from '@/features/onboarding';
import { useRequestAccountDeletion } from '@/features/moderation';
import { SyncBadge, useMyRecentSubmissions } from '@/features/proofs';
import type { Submission } from '@/entities';

type Tab = 'submissions' | 'ranking';

// Profile tab — personal, decorative. Header is the user's name (not "Profile"). All
// settings/account/danger-zone moved behind the 3-dot button (top right of the in-screen
// header), opening a slide-up BottomSheet. Body has avatar + name + description, then a
// SegmentedControl with Submissions and World ranking tabs.
export default function ProfileScreen() {
  const t = useTheme();
  const router = useRouter();
  const session = useSession();
  const signOut = useSignOut();
  const profile = useProfile();
  const submissions = useMyRecentSubmissions();
  const deletionRequest = useRequestAccountDeletion();

  const [menuOpen, setMenuOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('submissions');
  const [deletionDone, setDeletionDone] = useState(false);

  const email = session.session?.user.email;
  const user = profile.data;
  const displayName = user?.displayName || user?.username || email?.split('@')[0] || 'You';
  const username = user?.username ? `@${user.username}` : null;
  const avatarRemoteUrl = useMemo(() => userAvatarUrl(user?.avatarUrl ?? null), [user?.avatarUrl]);

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

  return (
    <Screen padded={false} edges={['top']}>
      {/* In-screen header. The Tabs layout disables the native header, so the 3-dot
          button lives here directly. Custom Pressable with opacity dip (not native
          highlight) so taps don't flash colors (fix C). */}
      <View
        style={{
          paddingHorizontal: t.spacing.lg,
          paddingTop: t.spacing.sm,
          paddingBottom: t.spacing.xs,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text variant="title" numberOfLines={1} style={{ flex: 1, marginRight: t.spacing.sm }}>
          {displayName}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Profile settings"
          onPress={() => setMenuOpen(true)}
          hitSlop={8}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.5 : 1,
          })}
        >
          <Icon name="settings" size={22} color={t.colors.foreground} />
        </Pressable>
      </View>

      {/* Header content (avatar/name/description) + tab bar + Submissions list all share
          the same scroll surface so the page feels like one piece. */}
      {tab === 'submissions' ? (
        <FlatList
          data={submissions.data ?? []}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.sm, paddingBottom: t.spacing.xxl }}
          ListHeaderComponent={
            <View style={{ gap: t.spacing.md, marginBottom: t.spacing.md }}>
              <ProfileHeader
                avatarUrl={avatarRemoteUrl}
                displayName={displayName}
                username={username}
                description={user?.description ?? undefined}
                email={email}
              />
              <SegmentedControl
                options={
                  [
                    { label: 'Submissions', value: 'submissions' },
                    { label: 'World ranking', value: 'ranking' },
                  ] as const
                }
                value={tab}
                onChange={setTab}
              />
            </View>
          }
          ListEmptyComponent={
            submissions.isPending ? (
              <Text variant="muted">Loading…</Text>
            ) : (
              <Card>
                <Text variant="subtitle">No submissions yet</Text>
                <Text variant="muted">Your proofs will appear here as you submit them.</Text>
              </Card>
            )
          }
          renderItem={({ item }) => <SubmissionListRow submission={item} onPress={() => router.push(`/submission/${item.id}` as Href)} />}
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.md }}>
          <ProfileHeader
            avatarUrl={avatarRemoteUrl}
            displayName={displayName}
            username={username}
            description={user?.description ?? undefined}
            email={email}
          />
          <SegmentedControl
            options={
              [
                { label: 'Submissions', value: 'submissions' },
                { label: 'World ranking', value: 'ranking' },
              ] as const
            }
            value={tab}
            onChange={setTab}
          />
          <Card>
            <Text variant="subtitle">World ranking</Text>
            <Text variant="muted">Coming soon. Global ranking across all groups will live here.</Text>
          </Card>
        </ScrollView>
      )}

      {/* 3-dot settings sheet (slides up as one body). */}
      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
        <BottomSheetMenuItem
          label="Edit profile"
          onPress={() => {
            setMenuOpen(false);
            router.push('/profile/edit' as Href);
          }}
        />
        <BottomSheetMenuItem
          label="Appearance"
          onPress={() => {
            setMenuOpen(false);
            router.push('/profile/appearance' as Href);
          }}
        />
        <BottomSheetMenuItem
          label="Blocked users"
          onPress={() => {
            setMenuOpen(false);
            router.push('/blocked-users' as Href);
          }}
        />
        {deletionDone ? null : (
          <BottomSheetMenuItem
            label={deletionRequest.isPending ? 'Requesting…' : 'Request account deletion'}
            destructive
            onPress={confirmDeletion}
          />
        )}
        <BottomSheetMenuItem
          label={signOut.isPending ? 'Signing out…' : 'Sign out'}
          destructive
          onPress={confirmSignOut}
        />
        <BottomSheetMenuItem label="Cancel" onPress={() => setMenuOpen(false)} />
      </BottomSheet>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────────

function ProfileHeader({
  avatarUrl,
  displayName,
  username,
  description,
  email,
}: {
  avatarUrl: string | null;
  displayName: string;
  username: string | null;
  description: string | undefined;
  email: string | undefined;
}) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: t.spacing.sm, paddingVertical: t.spacing.md }}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={{ width: 96, height: 96, borderRadius: 48 }} />
      ) : (
        <Avatar name={displayName} size={96} />
      )}
      <Text variant="heading" style={{ textAlign: 'center' }}>
        {displayName}
      </Text>
      {username ? (
        <Text variant="muted" style={{ textAlign: 'center' }}>
          {username}
        </Text>
      ) : null}
      {description ? (
        <Text variant="body" style={{ textAlign: 'center', paddingHorizontal: t.spacing.md }}>
          {description}
        </Text>
      ) : null}
      {!description && !username ? (
        <Text variant="caption" numberOfLines={1} style={{ textAlign: 'center' }}>
          {email ?? ''}
        </Text>
      ) : null}
    </View>
  );
}

function SubmissionListRow({ submission, onPress }: { submission: Submission; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: t.spacing.md }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="subtitle">Day {submission.challengeDay + 1}</Text>
            <Text variant="muted">{new Date(submission.createdAt).toLocaleString()}</Text>
            {submission.comment ? (
              <Text variant="caption" numberOfLines={2}>
                {submission.comment}
              </Text>
            ) : null}
          </View>
          <SyncBadge status={submission.status} />
        </View>
      </Card>
    </Pressable>
  );
}
