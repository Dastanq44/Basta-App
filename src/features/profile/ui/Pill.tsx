import { View } from 'react-native';
import { Text, useTheme } from '@/shared/ui';

export type PillTone = 'muted' | 'primary' | 'success';

/** Tiny status pill used on the profile challenge/group cards (Active / Completed / Hidden / role). */
export function Pill({ label, tone = 'muted' }: { label: string; tone?: PillTone }) {
  const t = useTheme();
  const color = tone === 'primary' ? t.colors.primary : tone === 'success' ? t.colors.success : t.colors.mutedForeground;
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: t.radius.full, backgroundColor: color + '22' }}>
      <Text style={{ fontSize: t.fontSize.xs, fontWeight: '700', color }}>{label}</Text>
    </View>
  );
}
