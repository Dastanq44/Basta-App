import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, Text, useTheme } from '@/shared/ui';
import {
  ProofComposer,
  useProofSignedUrl,
  useRedactMySubmission,
  useTodaySubmission,
} from '@/features/proofs';

// Thin route: edit today's submission in place. Reuses the ProofComposer in "redact" mode;
// orchestration goes through useRedactMySubmission (direct upload + RPC, NOT the offline
// queue — see hook comment). Closes immediately on success.
export default function EditProofModal() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const today = useTodaySubmission(id);
  const existingImage = useProofSignedUrl(today.data?.mediaRemotePath);
  const redact = useRedactMySubmission();

  if (today.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Edit proof', presentation: 'modal' }} />
        <Text variant="muted">Loading…</Text>
      </Screen>
    );
  }
  if (today.isError || !today.data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Edit proof', presentation: 'modal' }} />
        <Text variant="title">Nothing to edit</Text>
        <Text variant="muted" style={{ color: t.colors.mutedForeground }}>
          {today.error instanceof Error
            ? today.error.message
            : "You haven't submitted today's proof yet."}
        </Text>
      </Screen>
    );
  }

  const submissionId = today.data.id;

  return (
    <>
      <Stack.Screen options={{ title: 'Edit proof', presentation: 'modal' }} />
      <ProofComposer
        submitting={redact.isPending}
        errorMessage={redact.error instanceof Error ? redact.error.message : null}
        initialTitle={today.data.title}
        initialComment={today.data.comment}
        initialImageUrl={existingImage.data}
        initialIsPublic={today.data.isPublic}
        ctaLabel={redact.isPending ? 'Saving…' : 'Save changes'}
        intro="Edit your title, photo, and description. Changing the photo makes group voters re-verify."
        onSubmit={async ({ title, mediaLocalUri, comment, isPublic }) => {
          if (!id) return;
          await redact.mutateAsync({
            submissionId,
            challengeId: id,
            title,
            mediaLocalUri, // omitted ⇒ keep existing photo
            existingMediaPath: today.data?.mediaRemotePath,
            comment,
            isPublic,
          });
          router.back();
        }}
      />
    </>
  );
}
