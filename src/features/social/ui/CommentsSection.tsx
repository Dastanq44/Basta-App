import { useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Input, Text, useTheme } from '@/shared/ui';
import { useAddComment, useComments } from '../hooks';

/** Comments thread + composer for a submission. */
export function CommentsSection({ submissionId }: { submissionId: string }) {
  const t = useTheme();
  const comments = useComments(submissionId);
  const add = useAddComment(submissionId);
  const [body, setBody] = useState('');

  const onSend = () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    add.mutate(trimmed, { onSuccess: () => setBody('') });
  };

  return (
    <View style={{ gap: t.spacing.md }}>
      <Text variant="heading">Comments</Text>

      {(comments.data ?? []).map((c) => (
        <Card key={c.id}>
          <View style={{ gap: t.spacing.xs }}>
            <Text variant="caption">{c.authorName ?? 'Member'}</Text>
            <Text variant="body">{c.body}</Text>
          </View>
        </Card>
      ))}
      {comments.data && comments.data.length === 0 ? (
        <Text variant="muted">No comments yet — be the first.</Text>
      ) : null}

      <View style={{ gap: t.spacing.sm }}>
        <Input
          placeholder="Add a comment…"
          value={body}
          onChangeText={setBody}
          maxLength={280}
          multiline
          editable={!add.isPending}
        />
        {add.isError ? (
          <Text variant="caption" style={{ color: t.colors.destructive }}>
            {add.error instanceof Error ? add.error.message : 'Could not post your comment.'}
          </Text>
        ) : null}
        <Button label="Post comment" onPress={onSend} loading={add.isPending} disabled={!body.trim()} />
      </View>
    </View>
  );
}
