import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, Text, useTheme } from '@/shared/ui';
import { useI18n } from '@/shared/i18n';
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
  const { t: tr } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const today = useTodaySubmission(id);
  const existingImage = useProofSignedUrl(today.data?.mediaRemotePath);
  const redact = useRedactMySubmission();

  if (today.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: tr('proof.editTitle'), presentation: 'modal' }} />
        <Text variant="muted">{tr('common.loading')}</Text>
      </Screen>
    );
  }
  if (today.isError || !today.data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: tr('proof.editTitle'), presentation: 'modal' }} />
        <Text variant="title">{tr('proof.nothingToEdit')}</Text>
        <Text variant="muted" style={{ color: t.colors.mutedForeground }}>
          {today.error instanceof Error ? today.error.message : tr('proof.notSubmittedYet')}
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
        ctaLabel={redact.isPending ? tr('common.saving') : tr('proof.save')}
        intro={tr('proof.editIntro')}
        onSubmit={async ({ title, mediaLocalUri, comment }) => {
          if (!id) return;
          await redact.mutateAsync({
            submissionId,
            challengeId: id,
            title,
            mediaLocalUri, // omitted ⇒ keep existing photo
            existingMediaPath: today.data?.mediaRemotePath,
            comment,
          });
          router.back();
        }}
      />
    </>
  );
}
