import { useState } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, Screen, Text, useTheme } from '@/shared/ui';
import { useSession } from '@/features/auth';
import { SyncBadge, useProofSignedUrl, useSubmission } from '@/features/proofs';
import { useVerifySubmission } from '@/features/verification';
import type { VerificationResult } from '@/entities';

// Thin route: load the proof → show the photo + comment → record an approve/reject vote.
// All "who may verify" + status math is server-side (D-003); this screen just surfaces errors.
export default function VerifySubmissionScreen() {
  const t = useTheme();
  const router = useRouter();
  const { submissionId } = useLocalSearchParams<{ submissionId: string }>();
  const session = useSession();
  const submission = useSubmission(submissionId);
  const media = useProofSignedUrl(submission.data?.mediaRemotePath);
  const verify = useVerifySubmission();

  const [pending, setPending] = useState<VerificationResult | null>(null);

  if (submission.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Verify proof' }} />
        <Text variant="muted">Loading…</Text>
      </Screen>
    );
  }
  if (submission.isError || !submission.data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Verify proof' }} />
        <Text variant="title">Proof unavailable</Text>
        <Text variant="caption" style={{ color: t.colors.destructive }}>
          {submission.error instanceof Error ? submission.error.message : 'Could not load this proof.'}
        </Text>
      </Screen>
    );
  }

  const s = submission.data;
  const myUid = session.session?.user.id;
  const isOwn = !!myUid && myUid === s.authorId;
  const isResolved = s.status === 'verified' || s.status === 'rejected';
  const canVote = !isOwn && !isResolved;

  function onVote(result: VerificationResult) {
    setPending(result);
    verify.mutate(
      { submissionId: s.id, challengeId: s.challengeId, result },
      {
        onSuccess: () => router.back(),
        onSettled: () => setPending(null),
      },
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: `Day ${s.challengeDay + 1}` }} />
      <View style={{ gap: t.spacing.md }}>
        <View
          style={{
            width: '100%',
            aspectRatio: 1,
            borderRadius: t.radius.md,
            backgroundColor: t.colors.muted,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {media.data ? (
            <Image source={{ uri: media.data }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          ) : media.isError ? (
            <Text variant="muted">Couldn’t load the photo.</Text>
          ) : s.mediaRemotePath ? (
            <ActivityIndicator color={t.colors.primary} />
          ) : (
            <Text variant="muted">No photo attached.</Text>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="heading">Day {s.challengeDay + 1}</Text>
          <SyncBadge status={s.status} />
        </View>

        {s.comment ? (
          <Card>
            <Text variant="body">{s.comment}</Text>
          </Card>
        ) : null}

        {verify.isError ? (
          <Text variant="caption" style={{ color: t.colors.destructive }}>
            {verify.error instanceof Error ? verify.error.message : 'Could not record your verification.'}
          </Text>
        ) : null}

        {isOwn ? (
          <Text variant="muted">You can’t verify your own proof.</Text>
        ) : isResolved ? (
          <Text variant="muted">This proof has already been {s.status}.</Text>
        ) : null}

        {canVote ? (
          <View style={{ flexDirection: 'row', gap: t.spacing.md }}>
            <View style={{ flex: 1 }}>
              <Button
                label="Reject"
                variant="destructive"
                loading={pending === 'reject'}
                disabled={verify.isPending}
                onPress={() => onVote('reject')}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Approve"
                loading={pending === 'approve'}
                disabled={verify.isPending}
                onPress={() => onVote('approve')}
              />
            </View>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
