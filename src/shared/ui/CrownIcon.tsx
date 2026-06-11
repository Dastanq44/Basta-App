import { View } from 'react-native';
import { useTheme } from './theme';

export type CrownIconProps = {
  /** Outer width in px (the height follows the crown's natural proportions). Default 14. */
  size?: number;
  /** Override color. Defaults to the theme's primary so the leader badge reads warmly. */
  color?: string;
};

/**
 * Compact crown badge — three rounded peaks topped with small "gem" dots over a
 * pill-rounded base. Pure `View` primitives so we add no icon dep (W-013 fallout).
 * Defaults to the theme's primary tint so the leader badge reads as an accent rather
 * than a muted glyph. Redesigned for T-053-D — see DECISIONS.md if you're tempted to
 * revert it to the older three-triangles silhouette.
 */
export function CrownIcon({ size = 14, color }: CrownIconProps) {
  const t = useTheme();
  const fill = color ?? t.colors.primary;

  const peakSize = Math.round(size * 0.28);
  const gemSize = Math.max(2, Math.round(size * 0.18));
  const baseHeight = Math.max(3, Math.round(size * 0.28));
  const peakRow = Math.round(size * 0.5);
  const middlePeakBoost = Math.round(size * 0.12);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Group leader"
      style={{ width: size, height: size, justifyContent: 'flex-end', alignItems: 'center' }}
    >
      {/* Three rounded peaks with gem dots. Middle peak is taller. */}
      <View
        style={{
          width: size,
          height: peakRow + middlePeakBoost,
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginBottom: -1,
        }}
      >
        <Peak size={peakSize} gem={gemSize} color={fill} />
        <Peak size={peakSize} gem={gemSize} color={fill} taller={middlePeakBoost} />
        <Peak size={peakSize} gem={gemSize} color={fill} />
      </View>

      {/* Rounded-pill base bar. */}
      <View
        style={{
          width: size,
          height: baseHeight,
          borderRadius: baseHeight / 2,
          backgroundColor: fill,
        }}
      />
    </View>
  );
}

function Peak({
  size,
  gem,
  color,
  taller = 0,
}: {
  size: number;
  gem: number;
  color: string;
  taller?: number;
}) {
  return (
    <View style={{ alignItems: 'center', gap: 1 }}>
      <View
        style={{
          width: gem,
          height: gem,
          borderRadius: gem / 2,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          width: size,
          height: size + taller,
          borderTopLeftRadius: size / 2,
          borderTopRightRadius: size / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}
