import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { useTheme } from './theme';

type Tone = 'streak' | 'success' | 'warning' | 'primary';

export type StatTileProps = {
  value: string | number;
  label: string;
  tone?: Tone;
  /** Emoji string or a custom node rendered in the tinted circle. */
  icon?: ReactNode | string;
};

/** Compact stat card: tinted icon circle + big value + caption (the home "streak / done / rank" tiles). */
export function StatTile({ value, label, tone = 'primary', icon }: StatTileProps) {
  const t = useTheme();
  const toneColor = { streak: t.colors.streak, success: t.colors.success, warning: t.colors.warning, primary: t.colors.primary }[tone];
  return (
    <View style={[styles.tile, { backgroundColor: t.colors.card, borderColor: t.colors.border, borderRadius: t.radius.lg }, t.shadow.sm]}>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: toneColor + '22', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
        {typeof icon === 'string' ? <Text style={{ fontSize: 16 }}>{icon}</Text> : icon}
      </View>
      <Text style={{ fontSize: t.fontSize.xl, fontWeight: '800', color: t.colors.foreground }}>{value}</Text>
      <Text variant="caption" numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, padding: 14, borderWidth: StyleSheet.hairlineWidth },
});
