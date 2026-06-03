import { View } from 'react-native';
import { useTheme } from './theme';

export type CrownIconProps = {
  /** Outer width in px (the height follows the crown's natural proportions). Default 14. */
  size?: number;
  /** Override color. Defaults to the theme's muted foreground for a neutral gray. */
  color?: string;
};

/**
 * Tiny crown badge built from pure `View` primitives — no dependency on icon libraries
 * (avoids the recurring SDK 54 `npm install` ERESOLVE described in W-013). The shape is
 * three upward-pointing triangles on a small bar, tintable to any color.
 *
 * Used to mark the group leader in `app/group/[id].tsx` leaderboard rows.
 */
export function CrownIcon({ size = 14, color }: CrownIconProps) {
  const t = useTheme();
  const fill = color ?? t.colors.mutedForeground;
  const peakHeight = Math.round(size * 0.55);
  const peakWidth = Math.round(size * 0.28);
  const sidePeakHeight = Math.round(peakHeight * 0.82);
  const barHeight = Math.max(2, Math.round(size * 0.22));

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Group leader"
      style={{ width: size, height: size, justifyContent: 'flex-end' }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: -1,
        }}
      >
        <Triangle width={peakWidth} height={sidePeakHeight} color={fill} />
        <Triangle width={peakWidth} height={peakHeight} color={fill} />
        <Triangle width={peakWidth} height={sidePeakHeight} color={fill} />
      </View>
      <View
        style={{
          height: barHeight,
          backgroundColor: fill,
          borderRadius: 1,
        }}
      />
    </View>
  );
}

/** Upward triangle via the classic border-trick. width = base; height = altitude. */
function Triangle({ width, height, color }: { width: number; height: number; color: string }) {
  return (
    <View
      style={{
        width: 0,
        height: 0,
        borderLeftWidth: width / 2,
        borderRightWidth: width / 2,
        borderBottomWidth: height,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: color,
      }}
    />
  );
}
