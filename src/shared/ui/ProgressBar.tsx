import { View } from 'react-native';
import { useTheme } from './theme';

export type ProgressBarProps = {
  /** 0..1 */
  value: number;
  height?: number;
  color?: string;
  trackColor?: string;
};

/** Rounded progress track with a violet fill. */
export function ProgressBar({ value, height = 8, color, trackColor }: ProgressBarProps) {
  const t = useTheme();
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: trackColor ?? t.colors.primarySoft, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: height / 2, backgroundColor: color ?? t.colors.primary }} />
    </View>
  );
}
