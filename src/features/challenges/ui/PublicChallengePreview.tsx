import { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { type Href, useRouter } from 'expo-router';
import { Button, Card, Icon, Screen, ScreenHeader, Text, useTheme } from '@/shared/ui';
import { ReportSheet } from '@/features/moderation';
import type { Submission } from '@/entities';
import type { ChallengeAccess } from '../api';
import { usePublicChallengeSubmissions } from '../hooks';

const DATE_FMT: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };

/** Read-only public preview of a challenge for non-participants. No submit/edit/delete/streak/verify
 *  controls, no invite code — just the public info + globally-visible verified proofs. */
export function PublicChallengePreview({ access }: { access: ChallengeAccess }) {
  const t = useTheme();
  const router = useRouter();
  const subs = usePublicChallengeSubmissions(access.id);
  const [reportOpen, setReportOpen] = useState(false);
  const isGroup = access.mode === 'group';

  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      <ScreenHeader
        title={access.title}
        onBack={() => router.back()}
        rightAction={
          access.canReport
            ? {
                icon: <Icon name="settings" size={22} color={t.colors.foreground} />,
                onPress: () => setReportOpen(true),
                accessibilityLabel: 'Report challenge',
              }
            : undefined
        }
      />
      <FlatList
        data={subs.data ?? []}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.sm, paddingBottom: t.spacing.xl }}
        ListHeaderComponent={
          <View style={{ gap: t.spacing.md, marginBottom: t.spacing.sm }}>
            <Text variant="title">{access.title}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs }}>
              <Chip label={titleCase(access.category)} />
              <Chip label={isGroup ? (access.groupName ? `Group · ${access.groupName}` : 'Group') : 'Solo'} />
              <Chip label={`${access.durationDays} days`} />
            </View>
            {access.proofRequirement ? (
              <Text variant="body" style={{ color: t.colors.mutedForeground }}>{access.proofRequirement}</Text>
            ) : null}
            <Card style={{ backgroundColor: t.colors.primarySoft }}>
              <Text variant="subtitle">Public preview</Text>
              <Text variant="muted">
                {isGroup
                  ? 'Join the group with an invite code to participate.'
                  : 'This is a public challenge preview.'}
              </Text>
            </Card>
            {isGroup ? (
              <Button
                label="Join with invite code"
                variant="secondary"
                onPress={() => router.push('/group/join-or-create' as Href)}
              />
            ) : null}
            <Text variant="heading" style={{ marginTop: t.spacing.sm }}>Public proofs</Text>
          </View>
        }
        ListEmptyComponent={
          subs.isPending ? <Text variant="muted">Loading…</Text> : <Text variant="muted">No public proofs yet.</Text>
        }
        renderItem={({ item }) => (
          <PreviewSubmissionRow submission={item} onPress={() => router.push(`/submission/${item.id}` as Href)} />
        )}
      />
      <ReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="challenge"
        targetId={access.id}
        targetLabel="this challenge"
      />
    </Screen>
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
          <Text variant="muted" numberOfLines={1}>{author} · Day {submission.challengeDay + 1} · {date}</Text>
          <Text variant="caption" style={{ color: t.colors.mutedForeground }}>
            {submission.reactionCount ?? 0} reactions · {submission.commentCount ?? 0} comments
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

function Chip({ label }: { label: string }) {
  const t = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: t.spacing.md,
        paddingVertical: 6,
        borderRadius: t.radius.lg,
        backgroundColor: t.colors.muted,
        borderWidth: 1,
        borderColor: t.colors.border,
      }}
    >
      <Text style={{ color: t.colors.foreground, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

function titleCase(s: string): string {
  if (!s) return s;
  return s[0]!.toUpperCase() + s.slice(1);
}
