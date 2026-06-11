import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Button, Card, Input, Screen, Text, useTheme } from '@/shared/ui';

export type ProofComposerSubmit = (input: {
  title: string;
  mediaLocalUri: string;
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
};

const TITLE_MAX = 80;

/**
 * Photo-first proof composer. Title required (W-034), photo required, description optional.
 * Stays presentational — orchestration (queue + upload) lives in the parent screen.
 * Used by BOTH the submit-proof modal (initial submission via the offline queue) and the
 * edit-proof modal (in-place redact, direct RPC).
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
}: ProofComposerProps) {
  const t = useTheme();
  const [title, setTitle] = useState(initialTitle ?? '');
  const [mediaLocalUri, setMediaLocalUri] = useState<string | null>(null);
  const [comment, setComment] = useState(initialComment ?? '');
  const [pickerError, setPickerError] = useState<string | null>(null);

  const trimmedTitle = title.trim();

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
    if (!mediaLocalUri) {
      setPickerError('Pick a photo first.');
      return;
    }
    try {
      await onSubmit({
        title: trimmedTitle,
        mediaLocalUri,
        comment: comment.trim() || undefined,
      });
    } catch (e) {
      Alert.alert('Could not save proof', e instanceof Error ? e.message : 'Unknown error');
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Screen padded={false}>
        <ScrollView contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.lg, paddingBottom: t.spacing.xl }}>
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

          {mediaLocalUri ? (
            <Card>
              <Image
                source={{ uri: mediaLocalUri }}
                accessibilityLabel="Selected proof photo"
                style={{ width: '100%', aspectRatio: 1, borderRadius: t.radius.md }}
                resizeMode="cover"
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => setMediaLocalUri(null)}
                disabled={submitting}
                style={{ alignSelf: 'flex-end', marginTop: t.spacing.sm }}
              >
                <Text variant="muted">Replace</Text>
              </Pressable>
            </Card>
          ) : (
            <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button label="Take photo" onPress={takePhoto} disabled={submitting} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="From library" variant="secondary" onPress={pickFromLibrary} disabled={submitting} />
              </View>
            </View>
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

          {errorMessage ? (
            <Text variant="caption" style={{ color: t.colors.destructive }}>{errorMessage}</Text>
          ) : null}

          <Button
            label={ctaLabel ?? (submitting ? 'Saving…' : 'Submit proof')}
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting || !trimmedTitle || !mediaLocalUri}
          />
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}
