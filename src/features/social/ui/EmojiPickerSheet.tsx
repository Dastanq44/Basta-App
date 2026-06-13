import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Text, useTheme } from '@/shared/ui';
import { EMOJI_CATEGORIES, searchEmojis, type EmojiCategory, type EmojiEntry } from '../model/emojiData';

const COLS = 8;
const SHEET_FRACTION = 0.6;
const OPEN_MS = 240;
const CLOSE_MS = 180;

/**
 * Custom emoji picker (replaces rn-emoji-keyboard). Fixed-height bottom sheet so the keyboard
 * doesn't shove the search bar up. Search lives at the top; the category bar's indigo highlight
 * is anchored to the horizontal page scroll, so it follows the swipe CONTINUOUSLY (and the
 * category icons are full-color emoji, so nothing snaps).
 */
export function EmojiPickerSheet({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
}) {
  const t = useTheme();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const sheetH = Math.round(screenH * SHEET_FRACTION);
  // Cell size + symmetric side padding derived from the ACTUAL device width (useWindowDimensions),
  // so the grid fills evenly with equal left/right margins on any phone — no hardcoded guess.
  const GRID_MIN_GAP = t.spacing.sm;
  const cellSize = Math.floor((screenW - 2 * GRID_MIN_GAP) / COLS);
  const gridSidePad = Math.max(0, Math.floor((screenW - cellSize * COLS) / 2));

  const [query, setQuery] = useState('');
  const searching = query.trim().length > 0;
  const results = useMemo(() => (searching ? searchEmojis(query) : []), [searching, query]);

  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s = Keyboard.addListener(showEvt, (e) => setKbHeight(e.endCoordinates?.height ?? 0));
    const h = Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => {
      s.remove();
      h.remove();
    };
  }, []);

  // Slide-up + backdrop fade (same decoupled pattern as the shared BottomSheet).
  const [mounted, setMounted] = useState(visible);
  const backdrop = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(sheetH)).current;
  useEffect(() => {
    if (visible) {
      setMounted(true);
      backdrop.setValue(0);
      sheetY.setValue(sheetH);
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 0.4, duration: OPEN_MS, useNativeDriver: true }),
        Animated.timing(sheetY, { toValue: 0, duration: OPEN_MS, useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 0, duration: CLOSE_MS, useNativeDriver: true }),
        Animated.timing(sheetY, { toValue: sheetH, duration: CLOSE_MS, useNativeDriver: true }),
      ]).start(({ finished }) => finished && setMounted(false));
    }
  }, [visible, mounted, backdrop, sheetY, sheetH]);

  // Category bar follow-highlight, driven by the horizontal pager's scroll position.
  const pagerRef = useRef<FlatList<EmojiCategory>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const tabW = screenW / EMOJI_CATEGORIES.length;
  const highlightX = scrollX.interpolate({
    inputRange: EMOJI_CATEGORIES.map((_, i) => i * screenW),
    outputRange: EMOJI_CATEGORIES.map((_, i) => i * tabW),
    extrapolate: 'clamp',
  });

  const close = () => {
    setQuery('');
    Keyboard.dismiss();
    onClose();
  };
  const pick = (emoji: string) => {
    setQuery('');
    onSelect(emoji);
  };

  if (!mounted) return null;

  const renderEmoji = (e: EmojiEntry) => (
    <Pressable
      key={`${e.emoji}-${e.name}`}
      accessibilityRole="button"
      accessibilityLabel={e.name}
      onPress={() => pick(e.emoji)}
      style={{ width: cellSize, height: cellSize, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text style={{ fontSize: cellSize * 0.55 }}>{e.emoji}</Text>
    </Pressable>
  );

  return (
    <Modal visible transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      <View style={{ flex: 1 }}>
        <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'black', opacity: backdrop }}>
          <Pressable style={{ flex: 1 }} onPress={close} />
        </Animated.View>

        <Animated.View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: sheetH,
            backgroundColor: t.colors.card,
            borderTopLeftRadius: t.radius.xl,
            borderTopRightRadius: t.radius.xl,
            overflow: 'hidden',
            transform: [{ translateY: sheetY }],
          }}
        >
          {/* Handle */}
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: t.colors.border, marginTop: t.spacing.sm, marginBottom: t.spacing.sm }} />

          {/* Search bar (top) */}
          <View style={{ paddingHorizontal: t.spacing.lg, marginBottom: t.spacing.sm }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: t.colors.muted,
                borderRadius: t.radius.full,
                paddingHorizontal: t.spacing.md,
                height: 40,
              }}
            >
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search emoji"
                placeholderTextColor={t.colors.mutedForeground}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                style={{ flex: 1, color: t.colors.foreground, fontSize: t.fontSize.md }}
              />
              {searching ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8} onPress={() => setQuery('')}>
                  <Text style={{ color: t.colors.mutedForeground, fontSize: 18, fontWeight: '700' }}>✕</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {searching ? (
            // Search results — a single grid; categories hidden while filtering.
            <FlatList
              data={results}
              keyExtractor={(e, i) => `${e.emoji}-${i}`}
              numColumns={COLS}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => renderEmoji(item)}
              contentContainerStyle={{ paddingHorizontal: gridSidePad, paddingBottom: kbHeight + t.spacing.lg }}
              ListEmptyComponent={
                <Text variant="muted" style={{ textAlign: 'center', marginTop: t.spacing.lg }}>
                  No emoji match “{query.trim()}”.
                </Text>
              }
            />
          ) : (
            <>
              {/* Category tabs (compact) with the continuous follow-highlight behind the icons. */}
              <View style={{ height: 36, justifyContent: 'center' }}>
                <Animated.View
                  style={{
                    position: 'absolute',
                    left: 0,
                    width: tabW,
                    height: 28,
                    top: 4,
                    borderRadius: t.radius.md,
                    backgroundColor: t.colors.primary,
                    transform: [{ translateX: highlightX }],
                  }}
                />
                <View style={{ flexDirection: 'row' }}>
                  {EMOJI_CATEGORIES.map((c, i) => (
                    <Pressable
                      key={c.key}
                      accessibilityRole="button"
                      accessibilityLabel={c.label}
                      onPress={() => pagerRef.current?.scrollToIndex({ index: i, animated: true })}
                      style={{ width: tabW, height: 36, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ fontSize: 16 }}>{c.icon}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Separator between the category bar and the emoji grid. */}
              <View style={{ height: 1, backgroundColor: t.colors.border, marginTop: t.spacing.xs, marginBottom: t.spacing.xs }} />

              {/* Horizontal paged grids — one page per category. */}
              <FlatList
                ref={pagerRef}
                data={EMOJI_CATEGORIES}
                keyExtractor={(c) => c.key}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                getItemLayout={(_, index) => ({ length: screenW, offset: screenW * index, index })}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
                scrollEventThrottle={16}
                windowSize={3}
                renderItem={({ item }) => (
                  <View style={{ width: screenW, flex: 1 }}>
                    <FlatList
                      data={item.emojis}
                      keyExtractor={(e, i) => `${e.emoji}-${i}`}
                      numColumns={COLS}
                      showsVerticalScrollIndicator
                      renderItem={({ item: e }) => renderEmoji(e)}
                      contentContainerStyle={{ paddingHorizontal: gridSidePad, paddingBottom: t.spacing.xl }}
                    />
                  </View>
                )}
              />
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}
