import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useI18n } from '@/shared/i18n';
import { ProofComposer, useSubmitProof } from '@/features/proofs';

// Thin route — orchestration via the feature hook. Returns immediately on success; the queue
// processor finishes the upload in the background and the detail screen reflects status via
// useQueueForChallenge + useTodaySubmission. No per-submission visibility control — Global
// eligibility is inherited from the profile/challenge/group (server-enforced).
export default function SubmitProofModal() {
  const router = useRouter();
  const { t: tr } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const submit = useSubmitProof();

  return (
    <>
      <Stack.Screen options={{ title: tr('proof.submitTitle'), presentation: 'modal' }} />
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
