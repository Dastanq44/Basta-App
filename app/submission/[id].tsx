import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, Platform, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { BottomSheet, BottomSheetMenuItem, Icon, ProofContextStrip, Screen, ScreenHeader, Text, useTheme } from '@/shared/ui';
import type { ProofContextItem } from '@/shared/ui';
import { useI18n } from '@/shared/i18n';
import { useSession } from '@/features/auth';
import { SyncBadge, useProofSignedUrl, useSubmission } from '@/features/proofs';
import { CommentsSection, ReactionBar } from '@/features/social';
import {
  ReportSheet,
  useBlockedUserIds,
  useBlockUser,
} from '@/features/moderation';

const SUBMISSION_DETAIL_DATE_FMT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

// Thin route: the social view of a submission — photo + comment + reactions + comments thread,
// plus Report / Block-author for non-owner submissions. Blocked authors' proofs are hidden.
export default function SubmissionScreen() {
  const t = useTheme();
  const router = useRouter();
  const { t: tr } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession();
  const myUid = session.session?.user.id;
  const submission = useSubmission(id);
  const media = useProofSignedUrl(submission.data?.mediaRemotePath);
  const blockedIds = useBlockedUserIds();
  const blockUser = useBlockUser();
  const [reportOpen, setReportOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  // Track the keyboard so the comment composer can rise well clear of it.
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(showEvt, (e) => {
      setKbHeight(e.endCoordinates?.height ?? 0);
      // Bring the composer up once the layout has the new bottom padding.
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    });
    const onHide = Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  // Extra clearance above the keyboard so the input sits comfortably, not flush against it.
  const COMPOSER_CLEARANCE = 36;

  if (submission.isPending) {
    return (
      <Screen padded={false} edges={['top']}>
        <ScreenHeader title={tr('common.proof')} onBack={() => router.back()} />
        <View style={{ padding: t.spacing.lg, alignItems: 'center', paddingTop: t.spacing.xxl }}>
          <ActivityIndicator color={t.colors.primary} />
        </View>
      </Screen>
    );
  }
  if (submission.isError || !submission.data) {
    return (
      <Screen padded={false} edges={['top']}>
        <ScreenHeader title={tr('common.proof')} onBack={() => router.back()} />
        <View style={{ padding: t.spacing.lg, gap: t.spacing.sm }}>
          <Text variant="title">Proof unavailable</Text>
          <Text variant="caption" style={{ color: t.colors.destructive }}>
            {submission.error instanceof Error ? submission.error.message : 'Could not load this proof.'}
          </Text>
        </View>
      </Screen>
    );
  }

  const s = submission.data;
  const isMine = !!myUid && s.authorId === myUid;
  const isBlocked = blockedIds.has(s.authorId);

  // Hide proofs authored by users the current viewer has blocked (client-side filter).
  // Server-side RLS still allows reads; we'd need broader RLS work to enforce this everywhere.
  if (isBlocked) {
    return (
      <Screen padded={false} edges={['top']}>
        <ScreenHeader title="Hidden" onBack={() => router.back()} />
        <View style={{ padding: t.spacing.lg, gap: t.spacing.md }}>
          <Text variant="title">Hidden</Text>
          <Text variant="muted">
            This proof is from a user you've blocked. Unblock them from your Profile to see
            their proofs again.
          </Text>
        </View>
      </Screen>
    );
  }

  const confirmBlock = () => {
    if (isMine) return;
    Alert.alert(
      'Block this user?',
      "You won't see their proofs, comments, or reactions. You can unblock anytime from Profile.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () =>
            blockUser.mutate(s.authorId, {
              onSuccess: () => router.back(),
              onError: (e: unknown) =>
                Alert.alert('Could not block', e instanceof Error ? e.message : 'Unknown error'),
            }),
        },
      ],
      { cancelable: true },
    );
  };

  // Context strip rows: author · challenge (with day) · group. Always tappable — the destination
  // route resolves full member detail vs read-only public preview (or "unavailable").
  const contextItems: ProofContextItem[] = [
    {
      key: 'author',
      label: 'Author',
      value: s.authorDisplayName || (s.authorUsername ? `@${s.authorUsername}` : 'Member'),
      sub: s.authorDisplayName && s.authorUsername ? `@${s.authorUsername}` : undefined,
      avatarName: s.authorDisplayName ?? s.authorUsername ?? null,
      onPress: () => router.push(`/user/${s.authorId}` as Href),
    },
    {
      key: 'challenge',
      label: 'Challenge',
      value: s.challengeTitle ?? 'Challenge',
      sub: tr('challenges.day') + ` ${s.challengeDay + 1}`,
      onPress: () => router.push(`/challenge/${s.challengeId}` as Href),
    },
    ...(s.challengeGroupId
      ? [
          {
            key: 'group',
            label: 'Group',
            value: s.challengeGroupName ?? 'Group',
            onPress: () => router.push(`/group/${s.challengeGroupId}` as Href),
          } satisfies ProofContextItem,
        ]
      : []),
  ];

  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      {/* In-body header (native header is off) — title + back + non-owner 3-dot menu. */}
      <ScreenHeader
        title={s.title}
        onBack={() => router.back()}
        rightAction={
          isMine
            ? undefined
            : {
                icon: <Icon name="settings" size={22} color={t.colors.foreground} />,
                onPress: () => setMenuOpen(true),
                accessibilityLabel: 'Proof actions',
              }
        }
      />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          padding: t.spacing.lg,
          gap: t.spacing.lg,
          // When the keyboard is up, pad below by its height + clearance so scrollToEnd lifts
          // the composer well above it (deterministic — no KeyboardAvoidingView offset guessing).
          paddingBottom: kbHeight > 0 ? kbHeight + COMPOSER_CLEARANCE : t.spacing.xl,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {/* Date + sync badge. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
          <Text variant="muted" style={{ flex: 1 }}>
            {new Date(s.createdAt).toLocaleString(undefined, SUBMISSION_DETAIL_DATE_FMT)}
          </Text>
          <SyncBadge status={s.status} />
        </View>

        <ProofContextStrip items={contextItems} />

        {/* Merged photo + description — the description card continues the photo as one unit. */}
        <View
          style={{
            borderRadius: t.radius.xl,
            borderWidth: 1,
            borderColor: t.colors.border,
            overflow: 'hidden',
            backgroundColor: t.colors.card,
          }}
        >
          <View
            style={{
              width: '100%',
              aspectRatio: 1,
              backgroundColor: t.colors.muted,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {media.data ? (
              <Image
                source={{ uri: media.data }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                transition={150}
                cachePolicy="memory-disk"
              />
            ) : media.isError ? (
              <Text variant="muted">Couldn&apos;t load the photo.</Text>
            ) : s.mediaRemotePath ? (
              <ActivityIndicator color={t.colors.primary} />
            ) : (
              <Text variant="muted">No photo attached.</Text>
            )}
          </View>
          {s.comment ? (
            <View style={{ padding: t.spacing.md }}>
              <Text variant="body">{s.comment}</Text>
            </View>
          ) : null}
        </View>

        <ReactionBar submissionId={s.id} />

        <CommentsSection
          submissionId={s.id}
          onComposerFocus={() => {
            // Let the keyboard finish animating in, then bring the composer above it.
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
          }}
        />

      </ScrollView>

      {/* Non-author proof actions, behind the top-right 3-dot menu. */}
      <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
        <BottomSheetMenuItem
          label="Report this proof"
          onPress={() => {
            setMenuOpen(false);
            // Let the menu sheet finish dismissing before the report modal opens (two modals
            // can't reliably show at once — this is why Report previously did nothing).
            setTimeout(() => setReportOpen(true), 250);
          }}
        />
        <BottomSheetMenuItem
          label={blockUser.isPending ? 'Blocking…' : 'Block author'}
          destructive
          onPress={() => {
            setMenuOpen(false);
            confirmBlock();
          }}
        />
      </BottomSheet>

      <ReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="submission"
        targetId={s.id}
        targetLabel="this proof"
      />
    </Screen>
  );
}
