import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ProofComposer, useSubmitProof } from '@/features/proofs';

// Thin route — orchestration via the feature hook. Returns immediately on success; the queue
// processor finishes the upload in the background and the detail screen reflects status via
// useQueueForChallenge + useTodaySubmission.
export default function SubmitProofModal() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const submit = useSubmitProof();

  return (
    <>
      <Stack.Screen options={{ title: 'Submit proof', presentation: 'modal' }} />
      <ProofComposer
        submitting={submit.isPending}
        errorMessage={submit.error instanceof Error ? submit.error.message : null}
        onSubmit={async ({ title, mediaLocalUri, comment }) => {
          // New submissions always require a fresh photo (no existing image to keep).
          if (!id || !mediaLocalUri) return;
          await submit.mutateAsync({ challengeId: id, title, mediaLocalUri, comment });
          router.back();
        }}
      />
    </>
  );
}
