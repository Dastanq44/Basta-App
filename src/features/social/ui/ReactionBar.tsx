import { useState } from 'react';
import { Pressable, View } from 'react-native';
import EmojiPicker from 'rn-emoji-keyboard';
import { Avatar, BottomSheet, Text, useTheme } from '@/shared/ui';
import { REACTION_EMOJIS } from '../model';
import {
  useReactToSubmission,
  useReactionReactors,
  useReactions,
} from '../hooks';

/**
 * Free-form reactions (T-053-C). Chips show the existing reactions with counts; a `(+)`
 * button on the right opens an inline preset popover with the canonical REACTION_EMOJIS
 * + a `(+)` that opens the full system-style emoji picker. Long-pressing any existing
 * reaction chip pops a sheet of users who reacted with it.
 */
export function ReactionBar({ submissionId }: { submissionId: string }) {
  const t = useTheme();
  const reactions = useReactions(submissionId);
  const react = useReactToSubmission(submissionId);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reactorsForEmoji, setReactorsForEmoji] = useState<string | null>(null);

  const mine = reactions.data?.mine;
  const counts = reactions.data?.counts ?? {};

  const emojiEntries = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);

  const choose = (emoji: string) => {
    setPresetsOpen(false);
    setPickerOpen(false);
    react.mutate(mine === emoji ? null : emoji);
  };

  return (
    <View style={{ gap: t.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: t.spacing.sm }}>
        {emojiEntries.map(([emoji, count]) => {
          const selected = mine === emoji;
          return (
            <Pressable
              key={emoji}
              accessibilityRole="button"
              accessibilityLabel={`React ${emoji}`}
              accessibilityHint="Hold to see who reacted with this"
              accessibilityState={{ selected }}
              disabled={react.isPending}
              hitSlop={6}
              onPress={() => choose(emoji)}
              onLongPress={() => setReactorsForEmoji(emoji)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: t.spacing.md,
                paddingVertical: 8,
                borderRadius: t.radius.full,
                backgroundColor: selected ? t.colors.accent : t.colors.muted,
                borderWidth: selected ? 0 : 1,
                borderColor: t.colors.border,
                opacity: react.isPending ? 0.6 : 1,
              }}
            >
              <Text style={{ fontSize: t.fontSize.md }}>{emoji}</Text>
              <Text
                style={{
                  fontSize: t.fontSize.sm,
                  fontWeight: '600',
                  color: selected ? t.colors.accentForeground : t.colors.mutedForeground,
                }}
              >
                {count}
              </Text>
            </Pressable>
          );
        })}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add reaction"
          disabled={react.isPending}
          hitSlop={6}
          onPress={() => setPresetsOpen((v) => !v)}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: t.colors.border,
            backgroundColor: t.colors.card,
          }}
        >
          <Text style={{ fontSize: 20, color: t.colors.foreground, lineHeight: 22 }}>+</Text>
        </Pressable>
      </View>

      {presetsOpen ? (
        <PresetsPopover
          onChoose={choose}
          onOpenFullPicker={() => {
            setPresetsOpen(false);
            setPickerOpen(true);
          }}
        />
      ) : null}

      <EmojiPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onEmojiSelected={(e) => choose(e.emoji)}
        enableSearchBar
        categoryPosition="top"
      />

      <ReactorsSheet
        submissionId={submissionId}
        emoji={reactorsForEmoji}
        onClose={() => setReactorsForEmoji(null)}
      />
    </View>
  );
}

function PresetsPopover({
  onChoose,
  onOpenFullPicker,
}: {
  onChoose: (emoji: string) => void;
  onOpenFullPicker: () => void;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.xs,
        alignSelf: 'flex-end',
        paddingHorizontal: t.spacing.sm,
        paddingVertical: 6,
        borderRadius: t.radius.full,
        borderWidth: 1,
        borderColor: t.colors.border,
        backgroundColor: t.colors.card,
      }}
    >
      {REACTION_EMOJIS.map((emoji) => (
        <Pressable
          key={emoji}
          accessibilityRole="button"
          accessibilityLabel={`React ${emoji}`}
          hitSlop={6}
          onPress={() => onChoose(emoji)}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 20 }}>{emoji}</Text>
        </Pressable>
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open full emoji picker"
        hitSlop={6}
        onPress={onOpenFullPicker}
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: t.colors.muted,
        }}
      >
        <Text style={{ fontSize: 18, color: t.colors.foreground, lineHeight: 20 }}>+</Text>
      </Pressable>
    </View>
  );
}

function ReactorsSheet({
  submissionId,
  emoji,
  onClose,
}: {
  submissionId: string;
  emoji: string | null;
  onClose: () => void;
}) {
  const t = useTheme();
  const reactors = useReactionReactors(submissionId, emoji ?? undefined, !!emoji);

  return (
    <BottomSheet visible={!!emoji} onClose={onClose}>
      <View style={{ gap: t.spacing.sm }}>
        <Text variant="heading">Reacted {emoji ?? ''}</Text>
        {reactors.isPending ? (
          <Text variant="muted">Loading…</Text>
        ) : reactors.isError ? (
          <Text variant="caption" style={{ color: t.colors.destructive }}>
            Could not load reactors.
          </Text>
        ) : (reactors.data ?? []).length === 0 ? (
          <Text variant="muted">Nobody yet.</Text>
        ) : (
          (reactors.data ?? []).map((u) => {
            const label = u.displayName ?? (u.username ? `@${u.username}` : 'Member');
            return (
              <View
                key={u.userId}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: t.spacing.sm,
                  paddingVertical: t.spacing.xs,
                }}
              >
                <Avatar name={u.displayName ?? u.username ?? null} size={32} />
                <Text variant="body">{label}</Text>
              </View>
            );
          })
        )}
      </View>
    </BottomSheet>
  );
}
