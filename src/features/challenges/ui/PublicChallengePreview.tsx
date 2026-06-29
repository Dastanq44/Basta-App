import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { type Href, Stack, useRouter } from 'expo-router';
import { BottomSheet, BottomSheetMenuItem, Button, Card, HeaderActionButton, PublicPreviewBanner, Screen, Text, useTheme } from '@/shared/ui';
import { formatChallengeCategory, formatDays, useI18n } from '@/shared/i18n';
import { ReportSheet } from '@/features/moderation';
import type { Submission } from '@/entities';
import type { ChallengeAccess } from '../api';
import { usePublicChallengeSubmissions } from '../hooks';
import { splitChallengeTitle } from '../model';

const DATE_FMT: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };

/** Read-only public preview of a challenge for non-participants. No submit/edit/delete/streak/verify
 *  controls, no invite code — just the public info + globally-visible verified proofs. */
export function PublicChallengePreview({ access }: { access: ChallengeAccess }) {
  const t = useTheme();
  const router = useRouter();
  const { t: tr, lang } = useI18n();
  const subs = usePublicChallengeSubmissions(access.id);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const isGroup = access.mode === 'group';
  const { emoji, name } = splitChallengeTitle(access.title);

  return (
    <Screen padded={false} edges={['bottom']}>
      {/* Native stack header — back chevron + centered title; Report lives in the native 3-dot. */}
      <Stack.Screen
        options={{
          title: access.title,
          headerRight: access.canReport
            ? () => <HeaderActionButton onPress={() => setMenuOpen(true)} accessibilityLabel={tr('challenge.settings')} />
            : undefined,
        }}
      />
      <FlatList
        data={subs.data ?? []}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.sm, paddingBottom: t.spacing.xl }}
        ListHeaderComponent={
          <View style={{ gap: t.spacing.md, marginBottom: t.spacing.sm }}>
            {/* On-page identity: emoji-as-icon + name (the compact title also lives in the header). */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: t.radius.lg,
                  backgroundColor: t.colors.primarySoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {emoji ? (
                  <Text style={{ fontSize: 30 }}>{emoji}</Text>
                ) : (
                  <Text style={{ fontSize: 22, fontWeight: '800', color: t.colors.primary }}>
                    {name.slice(0, 1).toUpperCase()}
                  </Text>
                )}
              </View>
              <Text variant="title" style={{ flex: 1 }} numberOfLines={2}>
                {name}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs }}>
              <Chip label={formatChallengeCategory(lang, access.category)} />
              <Chip label={isGroup ? (access.groupName ? `${tr('common.groups')} · ${access.groupName}` : tr('common.groups')) : tr('mode.solo')} />
              <Chip label={formatDays(lang, access.durationDays)} />
            </View>
            {access.proofRequirement ? (
              <Text variant="body" style={{ color: t.colors.mutedForeground }}>{access.proofRequirement}</Text>
            ) : null}
            <PublicPreviewBanner
              message={isGroup ? tr('preview.groupBody') : tr('preview.challengeBody')}
            />
            <Text variant="heading" style={{ marginTop: t.spacing.sm }}>{tr('common.proofs')}</Text>
          </View>
        }
        ListEmptyComponent={
          subs.isPending ? <Text variant="muted">{tr('common.loading')}</Text> : <Text variant="muted">{tr('challenge.noProofs')}</Text>
        }
        renderItem={({ item }) => (
          <PreviewSubmissionRow submission={item} onPress={() => router.push(`/submission/${item.id}` as Href)} />
        )}
      />

      {/* Persistent join CTA — group challenges can be joined with an invite code; pinned so the
          action is always visible on a read-only preview. */}
      {isGroup ? (
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
      ) : null}

      {/* 3-dot actions → bottom sheet (then the report window). */}
      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
        <BottomSheetMenuItem
          label={tr('report.reportChallenge')}
          onPress={() => {
            setMenuOpen(false);
            // Let the menu sheet finish dismissing before the report modal opens.
            setTimeout(() => setReportOpen(true), 250);
          }}
        />
      </BottomSheet>

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
  const { t: tr, tn, fmtDate } = useI18n();
  const author = submission.authorDisplayName || (submission.authorUsername ? `@${submission.authorUsername}` : tr('common.member'));
  const date = fmtDate(submission.createdAt, DATE_FMT);
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card>
        <View style={{ gap: 2 }}>
          <Text variant="subtitle" numberOfLines={1}>{submission.title}</Text>
          <Text variant="muted" numberOfLines={1}>{author} · {tr('day.n', { n: submission.challengeDay + 1 })} · {date}</Text>
          <Text variant="caption" style={{ color: t.colors.mutedForeground }}>
            {tn('social.reactions', submission.reactionCount ?? 0)} · {tn('social.comments', submission.commentCount ?? 0)}
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
