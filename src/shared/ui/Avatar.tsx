import { useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { Text } from './Text';

// Steppe-sky avatar palette — sky-blues + gold + teal + terracotta, deterministic per name
// (we often have a username but no photo). Intentionally NOT theme tokens: these stay stable
// across light/dark so a given person keeps the same color.
const PALETTE = ['#0E5AA8', '#2B79B5', '#0AA0A6', '#C99412', '#3B82F6', '#5B8C5A', '#C44536'];

function pick(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length] ?? PALETTE[0]!;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]!;
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1]!;
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase();
}

export type AvatarProps = {
  name?: string | null;
  size?: number;
  /** Optional remote/public image URL. Falls back to deterministic initials on missing/error. */
  uri?: string | null;
};

/** Circular avatar — renders a cached image when `uri` is set (expo-image, memory+disk cache),
 *  otherwise deterministic initials on a per-name color. */
export function Avatar({ name, size = 44, uri }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const label = (name ?? '').trim();
  const bg = label ? pick(label) : '#5C6B7B';
  const showImage = !!uri && !failed;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {showImage ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          contentFit="cover"
          transition={120}
          cachePolicy="memory-disk"
          onError={() => setFailed(true)}
        />
      ) : (
        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: size * 0.38 }}>
          {label ? initials(label) : '?'}
        </Text>
      )}
    </View>
  );
}
