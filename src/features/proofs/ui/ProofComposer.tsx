import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Button, Card, Input, Screen, Text, useTheme } from '@/shared/ui';
import { useI18n } from '@/shared/i18n';

export type ProofComposerSubmit = (input: {
  title: string;
  /** New photo to upload. Omitted when the user keeps the existing photo (edit mode). */
  mediaLocalUri?: string;
  comment?: string;
}) => Promise<void>;

export type ProofComposerProps = {
  onSubmit: ProofComposerSubmit;
  submitting: boolean;
  errorMessage?: string | null;
  /** Optional override for the screen heading — defaults to "Today's proof". */
  screenTitle?: string;
  /** Optional override for the helper line under the heading. */
  intro?: string;
  /** Optional override for the primary CTA label (e.g. "Save changes" in edit mode). */
  ctaLabel?: string;
  /** Pre-fill the title field — used by the redact (edit) flow. */
  initialTitle?: string;
  /** Pre-fill the description field — used by the redact (edit) flow. */
  initialComment?: string;
  /** Existing photo URL shown in edit mode. Kept unless the user picks a new one. */
  initialImageUrl?: string | null;
};

const TITLE_MAX = 80;

/**
 * Photo-first proof composer. Title required (W-034), photo required, description optional.
 * In edit mode an `initialImageUrl` is shown and kept unless the user picks a new photo —
 * so a description-only edit doesn't re-upload (and the existing image never disappears).
 * Stays presentational — orchestration (queue + upload) lives in the parent screen.
 */
export function ProofComposer({
  onSubmit,
  submitting,
  errorMessage,
  screenTitle,
  intro,
  ctaLabel,
  initialTitle,
  initialComment,
  initialImageUrl,
}: ProofComposerProps) {
  const t = useTheme();
  const { t: tr } = useI18n();
  const [title, setTitle] = useState(initialTitle ?? '');
  const [mediaLocalUri, setMediaLocalUri] = useState<string | null>(null);
  const [comment, setComment] = useState(initialComment ?? '');
  const [pickerError, setPickerError] = useState<string | null>(null);

  const trimmedTitle = title.trim();
  // What's shown: a freshly-picked photo wins; otherwise the existing one (edit mode).
  const shownImage = mediaLocalUri ?? initialImageUrl ?? null;
  const hasImage = !!shownImage;

  const pickFromLibrary = async () => {
    setPickerError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setPickerError(tr('proof.libDenied'));
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });
    if (!res.canceled && res.assets[0]) setMediaLocalUri(res.assets[0].uri);
  };

  const takePhoto = async () => {
    setPickerError(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setPickerError(tr('proof.camDenied'));
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });
    if (!res.canceled && res.assets[0]) setMediaLocalUri(res.assets[0].uri);
  };

  const handleSubmit = async () => {
    if (!trimmedTitle) {
      setPickerError(tr('proof.addTitle'));
      return;
    }
    if (!hasImage) {
      setPickerError(tr('proof.pickPhoto'));
      return;
    }
    try {
      await onSubmit({
        title: trimmedTitle,
        // Omit when keeping the existing image (no new pick).
        mediaLocalUri: mediaLocalUri ?? undefined,
        comment: comment.trim() || undefined,
      });
    } catch (e) {
      Alert.alert(tr('proof.couldNotSave'), e instanceof Error ? e.message : tr('common.error'));
    }
  };

  const ChangeButtons = (
    <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
      <View style={{ flex: 1 }}>
        <Button label={tr('proof.takePhoto')} onPress={takePhoto} disabled={submitting} />
      </View>
      <View style={{ flex: 1 }}>
        <Button label={tr('proof.fromLibrary')} variant="secondary" onPress={pickFromLibrary} disabled={submitting} />
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Screen padded={false}>
        <ScrollView
          contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.lg, paddingBottom: t.spacing.xl }}
          keyboardShouldPersistTaps="handled"
        >
          <Text variant="title">{screenTitle ?? tr('proof.todaysProof')}</Text>
          <Text variant="muted">{intro ?? tr('proof.intro')}</Text>

          <Input
            label={tr('proof.titleLabel')}
            value={title}
            onChangeText={(v) => setTitle(v.slice(0, TITLE_MAX))}
            placeholder={tr('proof.titleHeadline')}
            maxLength={TITLE_MAX}
            editable={!submitting}
            returnKeyType="done"
          />

          {hasImage ? (
            <View style={{ gap: t.spacing.sm }}>
              <Card>
                <Image
                  source={{ uri: shownImage! }}
                  accessibilityLabel={tr('proof.photoA11y')}
                  style={{ width: '100%', aspectRatio: 1, borderRadius: t.radius.md }}
                  resizeMode="cover"
                />
              </Card>
              {/* Photo is shown but replaceable — the existing one never just disappears. */}
              <Text variant="caption" style={{ color: t.colors.mutedForeground }}>
                {mediaLocalUri ? tr('proof.newPhoto') : tr('proof.currentPhoto')}
              </Text>
              {ChangeButtons}
            </View>
          ) : (
            ChangeButtons
          )}

          {pickerError ? (
            <Text variant="caption" style={{ color: t.colors.destructive }}>{pickerError}</Text>
          ) : null}

          <Input
            label={tr('proof.descLabel')}
            value={comment}
            onChangeText={setComment}
            placeholder={tr('proof.descPlaceholder2')}
            multiline
            numberOfLines={3}
            editable={!submitting}
          />

          {/* No per-submission public/private control — visibility is inherited from the profile,
              challenge, and group (Spotify-playlist model). Server is the source of truth. */}
          <Text variant="caption" style={{ color: t.colors.mutedForeground }}>
            {tr('proof.globalNote')}
          </Text>

          {errorMessage ? (
            <Text variant="caption" style={{ color: t.colors.destructive }}>{errorMessage}</Text>
          ) : null}

          <Button
            label={ctaLabel ?? (submitting ? tr('common.saving') : tr('proof.submit'))}
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting || !trimmedTitle || !hasImage}
          />
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}
