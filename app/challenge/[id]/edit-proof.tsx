import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, Text, useTheme } from '@/shared/ui';
import {
  ProofComposer,
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
        initialComment={today.data.comment}
        ctaLabel={redact.isPending ? 'Saving…' : 'Save changes'}
        intro="Replace today's photo and edit your note. Group voters will re-verify the new content."
        onSubmit={async ({ mediaLocalUri, comment }) => {
          if (!id) return;
          await redact.mutateAsync({
            submissionId,
            challengeId: id,
            mediaLocalUri,
            comment,
          });
          router.back();
        }}
      />
    </>
  );
}
