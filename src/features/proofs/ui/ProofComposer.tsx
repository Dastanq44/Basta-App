import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Button, Card, Input, Screen, Text, useTheme, VisibilityToggle } from '@/shared/ui';

export type ProofComposerSubmit = (input: {
  title: string;
  /** New photo to upload. Omitted when the user keeps the existing photo (edit mode). */
  mediaLocalUri?: string;
  comment?: string;
  /** "Share to Global" opt-in. Default off — never shared by accident. */
  isPublic: boolean;
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
  /** Pre-fill the "Share to Global" toggle — used by the redact (edit) flow. Default off. */
  initialIsPublic?: boolean;
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
  initialIsPublic,
}: ProofComposerProps) {
  const t = useTheme();
  const [title, setTitle] = useState(initialTitle ?? '');
  const [mediaLocalUri, setMediaLocalUri] = useState<string | null>(null);
  const [comment, setComment] = useState(initialComment ?? '');
  const [isPublic, setIsPublic] = useState(initialIsPublic ?? false);
  const [pickerError, setPickerError] = useState<string | null>(null);

  const trimmedTitle = title.trim();
  // What's shown: a freshly-picked photo wins; otherwise the existing one (edit mode).
  const shownImage = mediaLocalUri ?? initialImageUrl ?? null;
  const hasImage = !!shownImage;

  const pickFromLibrary = async () => {
    setPickerError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setPickerError('Photo library access denied. Enable it in Settings.');
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
      setPickerError('Camera access denied. Enable it in Settings.');
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
      setPickerError('Add a title.');
      return;
    }
    if (!hasImage) {
      setPickerError('Pick a photo first.');
      return;
    }
    try {
      await onSubmit({
        title: trimmedTitle,
        // Omit when keeping the existing image (no new pick).
        mediaLocalUri: mediaLocalUri ?? undefined,
        comment: comment.trim() || undefined,
        isPublic,
      });
    } catch (e) {
      Alert.alert('Could not save proof', e instanceof Error ? e.message : 'Unknown error');
    }
  };

  const ChangeButtons = (
    <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
      <View style={{ flex: 1 }}>
        <Button label="Take photo" onPress={takePhoto} disabled={submitting} />
      </View>
      <View style={{ flex: 1 }}>
        <Button label="From library" variant="secondary" onPress={pickFromLibrary} disabled={submitting} />
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
          <Text variant="title">{screenTitle ?? "Today's proof"}</Text>
          <Text variant="muted">
            {intro ?? 'Give it a title, snap a photo, and add a description if you want.'}
          </Text>

          <Input
            label="Title"
            value={title}
            onChangeText={(v) => setTitle(v.slice(0, TITLE_MAX))}
            placeholder="Short headline for today"
            maxLength={TITLE_MAX}
            editable={!submitting}
            returnKeyType="done"
          />

          {hasImage ? (
            <View style={{ gap: t.spacing.sm }}>
              <Card>
                <Image
                  source={{ uri: shownImage! }}
                  accessibilityLabel="Proof photo"
                  style={{ width: '100%', aspectRatio: 1, borderRadius: t.radius.md }}
                  resizeMode="cover"
                />
              </Card>
              {/* Photo is shown but replaceable — the existing one never just disappears. */}
              <Text variant="caption" style={{ color: t.colors.mutedForeground }}>
                {mediaLocalUri ? 'New photo selected.' : 'Current photo — change it below if you want.'}
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
            label="Description (optional)"
            value={comment}
            onChangeText={setComment}
            placeholder="What did you do today?"
            multiline
            numberOfLines={3}
            editable={!submitting}
          />

          <Card>
            <VisibilityToggle
              value={isPublic}
              onValueChange={setIsPublic}
              title="Share to Global"
              description={
                isPublic
                  ? 'Once verified, this proof can appear in Global discovery.'
                  : 'Off — only your challenge participants will see this proof.'
              }
              disabled={submitting}
            />
          </Card>

          {errorMessage ? (
            <Text variant="caption" style={{ color: t.colors.destructive }}>{errorMessage}</Text>
          ) : null}

          <Button
            label={ctaLabel ?? (submitting ? 'Saving…' : 'Submit proof')}
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting || !trimmedTitle || !hasImage}
          />
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}
