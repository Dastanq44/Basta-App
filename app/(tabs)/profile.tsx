import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Image, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import {
  Avatar,
  BottomSheet,
  BottomSheetMenuItem,
  Card,
  Icon,
  Screen,
  SegmentedControl,
  StatTile,
  Text,
  useTheme,
} from '@/shared/ui';
import { useSession, useSignOut } from '@/features/auth';
import { useProfile, userAvatarUrl } from '@/features/onboarding';
import { useMyStreakAggregate } from '@/features/home';
import { useRequestAccountDeletion } from '@/features/moderation';
import { SyncBadge, useMyRecentSubmissions } from '@/features/proofs';
import { ActivityHeatmap } from '@/features/profile';
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
  const streak = useMyStreakAggregate();
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

  const onRefresh = useCallback(() => {
    void profile.refetch();
    void submissions.refetch();
    void streak.refetch();
  }, [profile, submissions, streak]);
  const refreshing =
    (profile.isFetching && !profile.isPending) ||
    (submissions.isFetching && !submissions.isPending) ||
    (streak.isFetching && !streak.isPending);

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
          Profile
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
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListHeaderComponent={
            <View style={{ gap: t.spacing.md, marginBottom: t.spacing.md }}>
              <ProfileHeader
                avatarUrl={avatarRemoteUrl}
                displayName={displayName}
                username={username}
                description={user?.description ?? undefined}
                email={email}
              />
              <StreakTiles
                current={streak.data?.currentStreak ?? 0}
                best={streak.data?.bestStreak ?? 0}
              />
              <ActivityHeatmap submissions={submissions.data ?? []} />
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
        <ScrollView
          contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.md }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <ProfileHeader
            avatarUrl={avatarRemoteUrl}
            displayName={displayName}
            username={username}
            description={user?.description ?? undefined}
            email={email}
          />
          <StreakTiles
            current={streak.data?.currentStreak ?? 0}
            best={streak.data?.bestStreak ?? 0}
          />
          <ActivityHeatmap submissions={submissions.data ?? []} />
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
        {/* No Cancel row — the backdrop tap dismisses, which keeps the sheet items tight. */}
      </BottomSheet>
    </Screen>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────────

function StreakTiles({ current, best }: { current: number; best: number }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
      <View style={{ flex: 1 }}>
        <StatTile
          tone="streak"
          icon="🔥"
          value={String(current)}
          label={`Current streak · ${current === 1 ? 'day' : 'days'}`}
        />
      </View>
      <View style={{ flex: 1 }}>
        <StatTile
          tone="primary"
          icon="🏆"
          value={String(best)}
          label={`Best streak · ${best === 1 ? 'day' : 'days'}`}
        />
      </View>
    </View>
  );
}

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
        <Image source={{ uri: avatarUrl }} style={{ width: 128, height: 128, borderRadius: 64 }} />
      ) : (
        <Avatar name={displayName} size={128} />
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

// ─────────────────────────────────────────────────────────────────────────────
// ActivityHeatmap lives in src/features/profile/ui/ActivityHeatmap.tsx (shared
// with the read-only user profile route at app/user/[id].tsx — T-053-D).
// ─────────────────────────────────────────────────────────────────────────────

// Profile rows show DATE ONLY (no clock time) — slice T-053-A.
const DATE_FMT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
};

function SubmissionListRow({ submission, onPress }: { submission: Submission; onPress: () => void }) {
  const t = useTheme();
  const title = submission.title?.trim() || 'Untitled';
  const dateLabel = new Date(submission.createdAt).toLocaleDateString(undefined, DATE_FMT);
  const subline = submission.challengeGroupName
    ? `${dateLabel} · ${submission.challengeGroupName}`
    : dateLabel;
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: t.spacing.md,
          }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="subtitle" numberOfLines={1}>
              {title}
            </Text>
            <Text variant="muted" numberOfLines={1}>
              {subline}
            </Text>
            {submission.comment ? (
              <Text variant="caption" numberOfLines={2}>
                {submission.comment}
              </Text>
            ) : null}
          </View>
          {/* Right column: gray "Day N" above the verification badge. */}
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Text variant="caption" style={{ color: t.colors.mutedForeground }}>
              Day {submission.challengeDay + 1}
            </Text>
            <SyncBadge status={submission.status} />
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
