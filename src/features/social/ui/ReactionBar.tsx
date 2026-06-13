import { useState } from 'react';
import { type LayoutRectangle, Pressable, View } from 'react-native';
import EmojiPicker from 'rn-emoji-keyboard';
import { Avatar, BottomSheet, Text, useTheme } from '@/shared/ui';
import { REACTION_EMOJIS } from '../model';
import {
  useReactToSubmission,
  useReactionReactors,
  useReactions,
} from '../hooks';

const PRESET_BTN = 36;

/**
 * Free-form reactions (T-053-C). Chips show the existing reactions (count only when > 1);
 * a `(+)` button opens an inline preset popover anchored beside it (opens to the right, flips
 * left if there's no room) with the canonical REACTION_EMOJIS + a `(+)` that opens the full
 * bottom-sheet emoji picker. Long-pressing a reaction chip shows who reacted with it.
 */
export function ReactionBar({ submissionId }: { submissionId: string }) {
  const t = useTheme();
  const reactions = useReactions(submissionId);
  const react = useReactToSubmission(submissionId);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reactorsForEmoji, setReactorsForEmoji] = useState<string | null>(null);
  const [barWidth, setBarWidth] = useState(0);
  const [plusRect, setPlusRect] = useState<LayoutRectangle | null>(null);

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

  // Popover geometry: width from its content; anchor beside the (+) button, flip to stay on-screen.
  const popoverWidth =
    (REACTION_EMOJIS.length + 1) * PRESET_BTN + REACTION_EMOJIS.length * t.spacing.xs + 2 * t.spacing.sm;
  const popoverPos = (() => {
    if (!plusRect) return null;
    const spaceRight = barWidth - (plusRect.x + plusRect.width);
    const openRight = spaceRight >= popoverWidth + t.spacing.xs;
    let left = openRight
      ? plusRect.x // start at the (+) left edge, extend right
      : plusRect.x + plusRect.width - popoverWidth; // end at the (+) right edge, extend left
    left = Math.max(0, Math.min(left, Math.max(0, barWidth - popoverWidth)));
    return { top: plusRect.y + plusRect.height + t.spacing.xs, left };
  })();

  return (
    <View style={{ gap: t.spacing.sm }}>
      <View style={{ position: 'relative' }} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}>
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
                {/* Count only when more than one — a single reaction just shows the emoji. */}
                {count > 1 ? (
                  <Text
                    style={{
                      fontSize: t.fontSize.sm,
                      fontWeight: '600',
                      color: selected ? t.colors.accentForeground : t.colors.mutedForeground,
                    }}
                  >
                    {count}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add reaction"
            disabled={react.isPending}
            hitSlop={6}
            onLayout={(e) => setPlusRect(e.nativeEvent.layout)}
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

        {presetsOpen && popoverPos ? (
          <PresetsPopover
            width={popoverWidth}
            top={popoverPos.top}
            left={popoverPos.left}
            onChoose={choose}
            onOpenFullPicker={() => {
              setPresetsOpen(false);
              setPickerOpen(true);
            }}
          />
        ) : null}
      </View>

      <EmojiPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onEmojiSelected={(e) => choose(e.emoji)}
        enableSearchBar
        // 'bottom' keeps the search bar at the TOP and the category bar fixed at the bottom
        // (a non-floating bar). 'top' would reverse the column and push search to the bottom;
        // 'floating' would make the category bar "levitate" over the emojis.
        categoryPosition="bottom"
        // The library grows the sheet by the keyboard height when typing (so it isn't covered),
        // which pushes the top-anchored search bar up. A shorter base height keeps the search
        // bar lower / closer to the keyboard while typing.
        defaultHeight="45%"
        expandable={false}
        // Extend content to the bottom edge — otherwise the safe-area inset leaves an
        // unfillable gap below the category bar.
        disableSafeArea
        // The library's active-category INDICATOR (a box behind the icons) tracks the swipe
        // continuously when this gesture is on; the icon color still snaps on landing. So we
        // make the moving box the indicator: indigo box (containerActive) sliding over a gray
        // bar (container), behind the icons — the indigo "follows" the finger. The active icon
        // flips to white only once it lands under the box.
        enableCategoryChangeGesture
        theme={{
          backdrop: '#00000066',
          knob: t.colors.border,
          container: t.colors.card,
          header: t.colors.foreground,
          category: {
            icon: t.colors.mutedForeground,
            iconActive: t.colors.primaryForeground,
            container: t.colors.muted,
            containerActive: t.colors.primary,
          },
          search: {
            background: t.colors.muted,
            text: t.colors.foreground,
            placeholder: t.colors.mutedForeground,
            icon: t.colors.mutedForeground,
          },
        }}
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
  width,
  top,
  left,
  onChoose,
  onOpenFullPicker,
}: {
  width: number;
  top: number;
  left: number;
  onChoose: (emoji: string) => void;
  onOpenFullPicker: () => void;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        position: 'absolute',
        top,
        left,
        width,
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.xs,
        paddingHorizontal: t.spacing.sm,
        paddingVertical: 6,
        borderRadius: t.radius.full,
        borderWidth: 1,
        borderColor: t.colors.border,
        backgroundColor: t.colors.card,
        // Float above the reaction chips.
        zIndex: 10,
        elevation: 6,
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
      }}
    >
      {REACTION_EMOJIS.map((emoji) => (
        <Pressable
          key={emoji}
          accessibilityRole="button"
          accessibilityLabel={`React ${emoji}`}
          hitSlop={6}
          onPress={() => onChoose(emoji)}
          style={{ width: PRESET_BTN, height: PRESET_BTN, borderRadius: PRESET_BTN / 2, alignItems: 'center', justifyContent: 'center' }}
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
          width: PRESET_BTN,
          height: PRESET_BTN,
          borderRadius: PRESET_BTN / 2,
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
    <BottomSheet visible={!!emoji} onClose={onClose} minHeight={300}>
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
