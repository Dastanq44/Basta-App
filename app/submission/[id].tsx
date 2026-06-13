import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Keyboard, Platform, Pressable, ScrollView, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Avatar, Button, Card, Screen, Text, useTheme } from '@/shared/ui';
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
  const COMPOSER_CLEARANCE = 72;

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
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: t.spacing.sm }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="title">{s.title}</Text>
          </View>
          <SyncBadge status={s.status} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
          <Avatar
            name={s.authorDisplayName ?? s.authorUsername ?? null}
            size={36}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="heading">
              {s.authorDisplayName || (s.authorUsername ? `@${s.authorUsername}` : 'Member')}
            </Text>
            <Text variant="muted">
              Day {s.challengeDay + 1} · {new Date(s.createdAt).toLocaleString(undefined, SUBMISSION_DETAIL_DATE_FMT)}
            </Text>
          </View>
        </View>

        <View
          style={{
            width: '100%',
            aspectRatio: 1,
            borderRadius: t.radius.xl,
            backgroundColor: t.colors.muted,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {media.data ? (
            <Image source={{ uri: media.data }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : media.isError ? (
            <Text variant="muted">Couldn't load the photo.</Text>
          ) : s.mediaRemotePath ? (
            <ActivityIndicator color={t.colors.primary} />
          ) : (
            <Text variant="muted">No photo attached.</Text>
          )}
        </View>

        {s.comment ? (
          <Card>
            <Text variant="body">{s.comment}</Text>
          </Card>
        ) : null}

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
