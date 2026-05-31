import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Button, Card, Input, Screen, Text, useTheme } from '@/shared/ui';

export type ProofComposerSubmit = (input: { mediaLocalUri: string; comment?: string }) => Promise<void>;

/**
 * Photo-first proof composer. Camera or library; comment is optional.
 * Stays a presentational component — orchestration (queue + upload) lives in the parent screen.
 */
export function ProofComposer({
  onSubmit,
  submitting,
  errorMessage,
}: {
  onSubmit: ProofComposerSubmit;
  submitting: boolean;
  errorMessage?: string | null;
}) {
  const t = useTheme();
  const [mediaLocalUri, setMediaLocalUri] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [pickerError, setPickerError] = useState<string | null>(null);

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
    if (!mediaLocalUri) {
      setPickerError('Pick a photo first.');
      return;
    }
    try {
      await onSubmit({ mediaLocalUri, comment: comment.trim() || undefined });
    } catch (e) {
      Alert.alert('Could not save proof', e instanceof Error ? e.message : 'Unknown error');
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Screen padded={false}>
        <ScrollView contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.lg, paddingBottom: t.spacing.xl }}>
          <Text variant="title">Today's proof</Text>
          <Text variant="muted">Take a photo or pick one from your library. You can add a short note.</Text>

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
            label="Note (optional)"
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
            label={submitting ? 'Saving…' : 'Submit proof'}
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting || !mediaLocalUri}
          />
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}
