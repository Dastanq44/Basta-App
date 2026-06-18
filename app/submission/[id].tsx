import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Keyboard, Platform, Pressable, ScrollView, View } from 'react-native';
import { type Href, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Screen, Text, useTheme } from '@/shared/ui';
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession();
  const myUid = session.session?.user.id;
  const submission = useSubmission(id);
  const media = useProofSignedUrl(submission.data?.mediaRemotePath);
  const blockedIds = useBlockedUserIds();
  const blockUser = useBlockUser();
  const [reportOpen, setReportOpen] = useState(false);
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
      <Screen>
        <Stack.Screen options={{ title: 'Proof' }} />
        <Text variant="muted">Loading…</Text>
      </Screen>
    );
  }
  if (submission.isError || !submission.data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Proof' }} />
        <Text variant="title">Proof unavailable</Text>
        <Text variant="caption" style={{ color: t.colors.destructive }}>
          {submission.error instanceof Error ? submission.error.message : 'Could not load this proof.'}
        </Text>
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
      <Screen>
        <Stack.Screen options={{ title: 'Hidden' }} />
        <View style={{ gap: t.spacing.md }}>
          <Text variant="title">Hidden</Text>
          <Text variant="muted">
            This proof is from a user you've blocked. Unblock them from your Profile to see
            their submissions again.
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

  return (
    // No 'top' edge — the native header already handles the top safe area; adding the inset
    // here stacked an empty band below the back button.
    <Screen padded={false} edges={['bottom']}>
      <Stack.Screen options={{ title: s.title }} />
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
        {/* Title + date + sync badge. */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: t.spacing.sm }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="title">{s.title}</Text>
            <Text variant="muted">
              {new Date(s.createdAt).toLocaleString(undefined, SUBMISSION_DETAIL_DATE_FMT)}
            </Text>
          </View>
          <SyncBadge status={s.status} />
        </View>

        {/* Context boxes: user · challenge (with day) · group. Clickable when openable. */}
        <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
          <ContextBox
            label="User"
            value={s.authorDisplayName || (s.authorUsername ? `@${s.authorUsername}` : 'Member')}
            sub={s.authorDisplayName && s.authorUsername ? `@${s.authorUsername}` : undefined}
            onPress={() => router.push(`/user/${s.authorId}` as Href)}
          />
          <ContextBox
            label="Challenge"
            value={s.challengeTitle ?? 'Challenge'}
            sub={`Day ${s.challengeDay + 1}`}
            onPress={s.canOpenChallenge ? () => router.push(`/challenge/${s.challengeId}` as Href) : undefined}
          />
          {s.challengeGroupId ? (
            <ContextBox
              label="Group"
              value={s.challengeGroupName ?? 'Group'}
              onPress={s.canOpenGroup ? () => router.push(`/group/${s.challengeGroupId}` as Href) : undefined}
            />
          ) : null}
        </View>

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
              <Image source={{ uri: media.data }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
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

        {!isMine ? (
          <View style={{ gap: t.spacing.sm, marginTop: t.spacing.md }}>
            <Pressable accessibilityRole="button" onPress={() => setReportOpen(true)} hitSlop={4}>
              <Text variant="muted" style={{ textAlign: 'center' }}>Report this proof</Text>
            </Pressable>
            <Button
              label={blockUser.isPending ? 'Blocking…' : 'Block author'}
              variant="destructive"
              onPress={confirmBlock}
              loading={blockUser.isPending}
              disabled={blockUser.isPending}
            />
          </View>
        ) : null}
      </ScrollView>

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

/** Small context box (user / challenge / group) shown under the submission title. Clickable when
 *  `onPress` is provided; otherwise a plain, non-interactive box (the viewer can't open that target). */
function ContextBox({
  label,
  value,
  sub,
  onPress,
}: {
  label: string;
  value: string;
  sub?: string;
  onPress?: () => void;
}) {
  const t = useTheme();
  const inner = (
    <View
      style={{
        flex: 1,
        padding: t.spacing.sm,
        borderRadius: t.radius.md,
        borderWidth: 1,
        borderColor: t.colors.border,
        backgroundColor: t.colors.card,
        gap: 2,
        minHeight: 58,
      }}
    >
      <Text variant="caption" style={{ color: t.colors.mutedForeground, fontSize: t.fontSize.xs }}>
        {label.toUpperCase()}
      </Text>
      <Text variant="subtitle" numberOfLines={1}>{value}</Text>
      {sub ? (
        <Text variant="caption" style={{ color: t.colors.mutedForeground }}>{sub}</Text>
      ) : null}
    </View>
  );
  return onPress ? (
    <Pressable style={{ flex: 1 }} accessibilityRole="button" onPress={onPress}>{inner}</Pressable>
  ) : (
    <View style={{ flex: 1 }}>{inner}</View>
  );
}
