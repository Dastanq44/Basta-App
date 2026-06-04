import { View } from 'react-native';
import { Text } from './Text';
import { useTheme } from './theme';

type Tone = 'primary' | 'muted' | 'success' | 'warning' | 'streak' | 'destructive';

export type BadgeProps = { label: string; tone?: Tone };

/** Small soft-tinted pill label (e.g. "5 members", "+3 streak"). */
export function Badge({ label, tone = 'primary' }: BadgeProps) {
  const t = useTheme();
  const color = {
    primary: t.colors.primary,
    muted: t.colors.mutedForeground,
    success: t.colors.success,
    warning: t.colors.warning,
    streak: t.colors.streak,
    destructive: t.colors.destructive,
  }[tone];
  return (
    <View style={{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: t.radius.full, backgroundColor: color + '1F' }}>
      <Text style={{ color, fontWeight: '700', fontSize: t.fontSize.xs }}>{label}</Text>
    </View>
  );
}
