import { View } from 'react-native';
import { Text } from './Text';

// Initials avatar with a deterministic color per name (we have usernames, not photos).
const PALETTE = ['#6C5CE7', '#F5A623', '#22C55E', '#FF7A1A', '#0AB6BC', '#E255A1', '#3B82F6'];

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

export type AvatarProps = { name?: string | null; size?: number };

export function Avatar({ name, size = 44 }: AvatarProps) {
  const label = (name ?? '').trim();
  const bg = label ? pick(label) : '#9A96AD';
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: size * 0.38 }}>{label ? initials(label) : '?'}</Text>
    </View>
  );
}
