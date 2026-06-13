import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ProofComposer, useSubmitProof } from '@/features/proofs';
import { useChallenge } from '@/features/challenges';

// Thin route — orchestration via the feature hook. Returns immediately on success; the queue
// processor finishes the upload in the background and the detail screen reflects status via
// useQueueForChallenge + useTodaySubmission.
export default function SubmitProofModal() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const submit = useSubmitProof();
  const challenge = useChallenge(id);

  return (
    <>
      <Stack.Screen options={{ title: 'Submit proof', presentation: 'modal' }} />
      <ProofComposer
        submitting={submit.isPending}
        errorMessage={submit.error instanceof Error ? submit.error.message : null}
        isGroupChallenge={challenge.data?.mode === 'group'}
        onSubmit={async ({ title, mediaLocalUri, comment, isPublic }) => {
          // New submissions always require a fresh photo (no existing image to keep).
          if (!id || !mediaLocalUri) return;
          await submit.mutateAsync({ challengeId: id, title, mediaLocalUri, comment, isPublic });
          router.back();
        }}
      />
    </>
  );
}
