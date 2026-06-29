import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { Card, Icon, Screen, SegmentedControl, Text, useTheme } from '@/shared/ui';
import { useI18n } from '@/shared/i18n';
import { usePublicProfile, userAvatarUrl } from '@/features/onboarding';
import { useUserRecentSubmissions } from '@/features/proofs';
import type { ProfileChallenge, ProfileGroup } from '../api';
import { useProfileOverview, useViewableUserChallenges, useViewableUserGroups } from '../hooks';
import { ProfileHeader } from './ProfileHeader';
import { ProfileStatsGrid } from './ProfileStatsGrid';
import { ActivityPreview, type ActivityDay } from './ActivityPreview';
import { ProfileSubmissionRow } from './ProfileSubmissionRow';
import { ProfileChallengeCard } from './ProfileChallengeCard';
import { ProfileGroupCard } from './ProfileGroupCard';
import type { Submission } from '@/entities';

type Tab = 'submissions' | 'challenges' | 'groups';
type RowItem = Submission | ProfileChallenge | ProfileGroup;

export type ProfileScreenProps = {
  userId: string;
  /** True on the current user's own tab — enables settings + own-only "Hidden/Private" indicators. */
  isOwn?: boolean;
  /** Opens the own-profile settings sheet (provided by the tab wrapper). */
  onOpenSettings?: () => void;
};

/**
 * Shared profile layout for both the own tab and the read-only `/user/[id]` route. Compact, content-
 * first: header → stats → world rank → 30-day activity preview → Submissions | Challenges | Groups.
 * All data is visibility-aware server-side; a private/inaccessible profile shows a graceful message.
 */
export function ProfileScreen({ userId, isOwn = false, onOpenSettings }: ProfileScreenProps) {
  const t = useTheme();
  const router = useRouter();
  const { t: tr } = useI18n();

  const profile = usePublicProfile(userId);
  const overview = useProfileOverview(userId);
  const submissions = useUserRecentSubmissions(userId);
  const challenges = useViewableUserChallenges(userId);
  const groups = useViewableUserGroups(userId);

  const [tab, setTab] = useState<Tab>('submissions');
  // Selected activity day lives here so it can be cleared on scroll / other interactions.
  const [activityDay, setActivityDay] = useState<ActivityDay | null>(null);

  const avatarRemoteUrl = useMemo(
    () => userAvatarUrl(profile.data?.avatarUrl ?? null),
    [profile.data?.avatarUrl],
  );

  const onRefresh = useCallback(() => {
    void profile.refetch();
    void overview.refetch();
    if (tab === 'submissions') void submissions.refetch();
    else if (tab === 'challenges') void challenges.refetch();
    else void groups.refetch();
  }, [profile, overview, submissions, challenges, groups, tab]);
  const refreshing =
    (profile.isFetching && !profile.isPending) || (overview.isFetching && !overview.isPending);

  // ── Loading + private/unavailable states ────────────────────────────────────
  if (profile.isPending) {
    return (
      <Screen edges={isOwn ? ['top'] : ['bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={t.colors.primary} />
        </View>
      </Screen>
    );
  }
  if (profile.isError || !profile.data) {
    return (
      <Screen edges={isOwn ? ['top'] : ['bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.spacing.sm }}>
          <Text variant="heading" style={{ textAlign: 'center' }}>{tr('profile.private')}</Text>
          <Text variant="muted" style={{ textAlign: 'center' }}>{tr('profile.privateBody')}</Text>
        </View>
      </Screen>
    );
  }

  const p = profile.data;
  const displayName = p.displayName || p.username || tr('common.member');
  const username = p.username ? `@${p.username}` : null;

  const activeData: RowItem[] =
    tab === 'submissions' ? (submissions.data ?? []) : tab === 'challenges' ? (challenges.data ?? []) : (groups.data ?? []);
  const activePending =
    tab === 'submissions' ? submissions.isPending : tab === 'challenges' ? challenges.isPending : groups.isPending;

  const renderItem = ({ item }: { item: RowItem }) => {
    if (tab === 'submissions') {
      const s = item as Submission;
      return <ProfileSubmissionRow submission={s} onPress={() => router.push(`/submission/${s.id}` as Href)} />;
    }
    if (tab === 'challenges') {
      const c = item as ProfileChallenge;
      return (
        <ProfileChallengeCard
          challenge={c}
          isOwn={isOwn}
          // Always tappable — the challenge route resolves member detail vs public preview.
          onPress={() => router.push({ pathname: '/challenge/[id]', params: { id: c.id } })}
        />
      );
    }
    const g = item as ProfileGroup;
    return (
      <ProfileGroupCard
        group={g}
        isOwn={isOwn}
        // Always tappable — the group route resolves member detail vs public preview.
        onPress={() => router.push({ pathname: '/group/[id]', params: { id: g.id } })}
      />
    );
  };

  const emptyCopy: Record<Tab, string> = {
    submissions: isOwn ? tr('profile.emptyProofsOwn') : tr('profile.emptyProofsOther'),
    challenges: isOwn ? tr('profile.emptyChallengesOwn') : tr('profile.emptyChallengesOther'),
    groups: isOwn ? tr('profile.emptyGroupsOwn') : tr('profile.emptyGroupsOther'),
  };

  const header = (
    <View style={{ gap: t.spacing.md, marginBottom: t.spacing.md }}>
      <ProfileHeader
        avatarUrl={avatarRemoteUrl}
        displayName={displayName}
        username={username}
        description={p.description}
      />
      <ProfileStatsGrid
        currentStreak={overview.data?.currentStreak ?? 0}
        bestStreak={overview.data?.bestStreak ?? 0}
        activeChallenges={overview.data?.activeChallengeCount ?? 0}
        groups={overview.data?.groupCount ?? 0}
      />
      {/* World Rank card hidden — no real ranking data yet (no placeholder by default). */}
      <ActivityPreview submissions={submissions.data ?? []} selected={activityDay} onSelect={setActivityDay} />
      <SegmentedControl
        options={[
          { label: tr('profile.proofs'), value: 'submissions' as Tab },
          { label: tr('profile.challenges'), value: 'challenges' as Tab },
          { label: tr('profile.groups'), value: 'groups' as Tab },
        ]}
        value={tab}
        onChange={setTab}
      />
    </View>
  );

  return (
    <Screen padded={false} edges={isOwn ? ['top'] : ['bottom']}>
      {isOwn ? (
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
            {tr('nav.profile')}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr('profile.settingsA11y')}
            onPress={onOpenSettings}
            hitSlop={8}
            style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}
          >
            <Icon name="settings" size={22} color={t.colors.foreground} />
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={activeData}
        keyExtractor={(item) => (item as { id: string }).id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.sm, paddingBottom: t.spacing.xxl, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={header}
        showsVerticalScrollIndicator={false}
        // Any scroll dismisses the activity day message (it isn't dismissed by tapping itself).
        onScrollBeginDrag={() => setActivityDay(null)}
        ListEmptyComponent={
          activePending ? (
            <View style={{ paddingVertical: t.spacing.lg, alignItems: 'center' }}>
              <ActivityIndicator color={t.colors.primary} />
            </View>
          ) : (
            <Card>
              <Text variant="muted">{emptyCopy[tab]}</Text>
            </Card>
          )
        }
      />
    </Screen>
  );
}
