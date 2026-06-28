import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import {
  Avatar,
  BottomSheet,
  BottomSheetMenuItem,
  Button,
  Card,
  EmptyStateCard,
  Icon,
  PublicPreviewBanner,
  Screen,
  ScreenHeader,
  SegmentedControl,
  Text,
  useTheme,
} from '@/shared/ui';
import { formatChallengeCategory, formatDays, useI18n } from '@/shared/i18n';
import { ReportSheet } from '@/features/moderation';
import type { Submission } from '@/entities';
import { groupAvatarUrl, type GroupAccess, type PublicGroupChallenge } from '../api';
import { usePublicGroupChallenges, usePublicGroupSubmissions } from '../hooks';

const DATE_FMT: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };

type Tab = 'overview' | 'challenges' | 'proofs';

/** Read-only public preview of a group for non-members: Overview / Challenges / Proofs. No invite
 *  code, member list, leaderboard, or settings — member identities are never exposed here. */
export function PublicGroupPreview({ access }: { access: GroupAccess }) {
  const t = useTheme();
  const router = useRouter();
  const { t: tr, fmtDate } = useI18n();
  const challenges = usePublicGroupChallenges(access.id);
  const submissions = usePublicGroupSubmissions(access.id);
  const [tab, setTab] = useState<Tab>('overview');
  const [menuOpen, setMenuOpen] = useState(false);
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
                onPress: () => setMenuOpen(true),
                accessibilityLabel: tr('group.settings'),
              }
            : undefined
        }
      />

      <View style={{ paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.md }}>
        <SegmentedControl
          options={[
            { label: tr('group.overview'), value: 'overview' },
            { label: tr('common.challenges'), value: 'challenges' },
            { label: tr('common.proofs'), value: 'proofs' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      <ScrollView contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.md, paddingBottom: t.spacing.xl }}>
        {tab === 'overview' ? (
          <>
            <View style={{ alignItems: 'center', gap: t.spacing.sm }}>
              <Avatar name={access.name} uri={avatarUrl} size={88} />
              <Text variant="title" style={{ textAlign: 'center' }}>{access.name}</Text>
              {access.description ? (
                <Text variant="muted" style={{ textAlign: 'center' }}>{access.description}</Text>
              ) : null}
            </View>

            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="muted">{tr('common.members')}</Text>
                <Text variant="subtitle">{access.memberCount}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: t.spacing.sm }}>
                <Text variant="muted">{tr('group.created')}</Text>
                <Text variant="subtitle">
                  {access.createdAt ? fmtDate(access.createdAt, DATE_FMT) : '—'}
                </Text>
              </View>
            </Card>

            <PublicPreviewBanner title={tr('preview.publicTitle')} message={tr('preview.groupBody')} />
          </>
        ) : tab === 'challenges' ? (
          challenges.isPending ? (
            <Text variant="muted">{tr('common.loading')}</Text>
          ) : (challenges.data ?? []).length === 0 ? (
            <EmptyStateCard title={tr('group.noChallenges')} body={tr('group.noChallengesBody')} icon="🎯" />
          ) : (
            (challenges.data ?? []).map((c) => (
              <PublicChallengeRow key={c.id} challenge={c} onPress={() => router.push(`/challenge/${c.id}` as Href)} />
            ))
          )
        ) : submissions.isPending ? (
          <Text variant="muted">{tr('common.loading')}</Text>
        ) : (submissions.data ?? []).length === 0 ? (
          <EmptyStateCard title={tr('group.noProofs')} body={tr('group.noProofsBody')} icon="📸" />
        ) : (
          (submissions.data ?? []).map((s) => (
            <PreviewSubmissionRow key={s.id} submission={s} onPress={() => router.push(`/submission/${s.id}` as Href)} />
          ))
        )}
      </ScrollView>

      {/* Persistent join CTA — always visible across tabs so a non-member can act at any time. */}
      <View
        style={{
          padding: t.spacing.lg,
          paddingTop: t.spacing.sm,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: t.colors.border,
          backgroundColor: t.colors.background,
        }}
      >
        <Button label={tr('preview.joinCta')} onPress={() => router.push('/group/join-or-create' as Href)} />
      </View>

      {/* 3-dot actions → bottom sheet (then the report window). */}
      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
        <BottomSheetMenuItem
          label={tr('report.reportGroup')}
          onPress={() => {
            setMenuOpen(false);
            setTimeout(() => setReportOpen(true), 250);
          }}
        />
      </BottomSheet>

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
  const { lang } = useI18n();
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, justifyContent: 'space-between' }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="subtitle" numberOfLines={1}>{challenge.title}</Text>
            <Text variant="muted">{formatChallengeCategory(lang, challenge.category)} · {formatDays(lang, challenge.durationDays)}</Text>
          </View>
          <Text variant="muted">›</Text>
        </View>
      </Card>
    </Pressable>
  );
}

function PreviewSubmissionRow({ submission, onPress }: { submission: Submission; onPress: () => void }) {
  const t = useTheme();
  const { t: tr, tn, fmtDate } = useI18n();
  const author = submission.authorDisplayName || (submission.authorUsername ? `@${submission.authorUsername}` : tr('common.member'));
  const date = fmtDate(submission.createdAt, DATE_FMT);
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card>
        <View style={{ gap: 2 }}>
          <Text variant="subtitle" numberOfLines={1}>{submission.title}</Text>
          <Text variant="muted" numberOfLines={1}>
            {author}{submission.challengeTitle ? ` · ${submission.challengeTitle}` : ''} · {date}
          </Text>
          <Text variant="caption" style={{ color: t.colors.mutedForeground }}>
            {tn('social.reactions', submission.reactionCount ?? 0)} · {tn('social.comments', submission.commentCount ?? 0)}
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}
