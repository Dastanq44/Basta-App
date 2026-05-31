import { ActivityIndicator, Image, ScrollView, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Card, Screen, Text, useTheme } from '@/shared/ui';
import { SyncBadge, useProofSignedUrl, useSubmission } from '@/features/proofs';
import { CommentsSection, ReactionBar } from '@/features/social';

// Thin route: the social view of a submission — photo + comment + reactions + comments thread.
export default function SubmissionScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const submission = useSubmission(id);
  const media = useProofSignedUrl(submission.data?.mediaRemotePath);

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

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ title: `Day ${s.challengeDay + 1}` }} />
      <ScrollView contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.lg, paddingBottom: t.spacing.xl }}>
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

        <ReactionBar submissionId={s.id} />

        <CommentsSection submissionId={s.id} />
      </ScrollView>
    </Screen>
  );
}
