import { useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { Avatar, Button, Card, Icon, Screen, ScreenHeader, Text, useTheme } from '@/shared/ui';
import { ReportSheet } from '@/features/moderation';
import type { Submission } from '@/entities';
import { groupAvatarUrl, type GroupAccess, type PublicGroupChallenge } from '../api';
import { usePublicGroupChallenges, usePublicGroupSubmissions } from '../hooks';

const DATE_FMT: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };

/** Read-only public preview of a group for non-members. No invite code, leaderboard, member list,
 *  or settings — just safe info + public challenges/proofs + a "join with code" CTA. */
export function PublicGroupPreview({ access }: { access: GroupAccess }) {
  const t = useTheme();
  const router = useRouter();
  const challenges = usePublicGroupChallenges(access.id);
  const submissions = usePublicGroupSubmissions(access.id);
  const [reportOpen, setReportOpen] = useState(false);
  const avatarUrl = groupAvatarUrl(access.avatarPath);

  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      <ScreenHeader
        title={access.name}
        onBack={() => router.back()}
        rightAction={
          access.canReport
            ? {
                icon: <Icon name="settings" size={22} color={t.colors.foreground} />,
                onPress: () => setReportOpen(true),
                accessibilityLabel: 'Report group',
              }
            : undefined
        }
      />
      <ScrollView contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.md, paddingBottom: t.spacing.xl }}>
        <View style={{ alignItems: 'center', gap: t.spacing.sm }}>
          {avatarUrl ? (
            <View style={{ width: 88, height: 88, borderRadius: 44, overflow: 'hidden', backgroundColor: t.colors.muted }}>
              <Image source={{ uri: avatarUrl }} style={{ width: 88, height: 88 }} resizeMode="cover" />
            </View>
          ) : (
            <Avatar name={access.name} size={88} />
          )}
          <Text variant="title" style={{ textAlign: 'center' }}>{access.name}</Text>
          {access.description ? (
            <Text variant="muted" style={{ textAlign: 'center' }}>{access.description}</Text>
          ) : null}
        </View>

        <Card style={{ backgroundColor: t.colors.primarySoft }}>
          <Text variant="subtitle">Public group</Text>
          <Text variant="muted">
            {access.memberCount} member{access.memberCount === 1 ? '' : 's'} · Join with an invite code to participate.
          </Text>
        </Card>

        <Button
          label="Join with invite code"
          variant="secondary"
          onPress={() => router.push('/group/join-or-create' as Href)}
        />

        <View style={{ gap: t.spacing.sm }}>
          <Text variant="heading">Public challenges</Text>
          {challenges.isPending ? (
            <Text variant="muted">Loading…</Text>
          ) : (challenges.data ?? []).length === 0 ? (
            <Text variant="muted">No public challenges yet.</Text>
          ) : (
            (challenges.data ?? []).map((c) => (
              <PublicChallengeRow
                key={c.id}
                challenge={c}
                onPress={() => router.push(`/challenge/${c.id}` as Href)}
              />
            ))
          )}
        </View>

        <View style={{ gap: t.spacing.sm }}>
          <Text variant="heading">Public proofs</Text>
          {submissions.isPending ? (
            <Text variant="muted">Loading…</Text>
          ) : (submissions.data ?? []).length === 0 ? (
            <Text variant="muted">No public proofs yet.</Text>
          ) : (
            (submissions.data ?? []).map((s) => (
              <PreviewSubmissionRow key={s.id} submission={s} onPress={() => router.push(`/submission/${s.id}` as Href)} />
            ))
          )}
        </View>
      </ScrollView>

      <ReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="group"
        targetId={access.id}
        targetLabel="this group"
      />
    </Screen>
  );
}

function PublicChallengeRow({ challenge, onPress }: { challenge: PublicGroupChallenge; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, justifyContent: 'space-between' }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="subtitle" numberOfLines={1}>{challenge.title}</Text>
            <Text variant="muted">{challenge.category} · {challenge.durationDays} days</Text>
          </View>
          <Text variant="muted">›</Text>
        </View>
      </Card>
    </Pressable>
  );
}

function PreviewSubmissionRow({ submission, onPress }: { submission: Submission; onPress: () => void }) {
  const t = useTheme();
  const author = submission.authorDisplayName || (submission.authorUsername ? `@${submission.authorUsername}` : 'Member');
  const date = new Date(submission.createdAt).toLocaleDateString(undefined, DATE_FMT);
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card>
        <View style={{ gap: 2 }}>
          <Text variant="subtitle" numberOfLines={1}>{submission.title}</Text>
          <Text variant="muted" numberOfLines={1}>
            {author}{submission.challengeTitle ? ` · ${submission.challengeTitle}` : ''} · {date}
          </Text>
          <Text variant="caption" style={{ color: t.colors.mutedForeground }}>
            {submission.reactionCount ?? 0} reactions · {submission.commentCount ?? 0} comments
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}
