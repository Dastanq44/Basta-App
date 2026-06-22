import { memo } from 'react';
import { View, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from './theme';

export type OrnamentMedallionProps = {
  /** Outer diameter in px. */
  size?: number;
  /** Motif color. Defaults to the sky-blue primary. */
  color?: string;
  /** Soft circular backdrop. Defaults to primarySoft. Pass 'transparent' for a bare motif. */
  background?: string;
  style?: ViewStyle;
};

/**
 * A small circular medallion: an 8-point steppe star (two overlapping squares) inside a thin
 * ring, with a filled diamond core. Used as a hero accent, empty-state glyph, or sheet-handle
 * accent — one per surface, never tiled. Memoized so the SVG isn't rebuilt on each render.
 */
export const OrnamentMedallion = memo(function OrnamentMedallion({
  size = 64,
  color,
  background,
  style,
}: OrnamentMedallionProps) {
  const t = useTheme();
  const c = color ?? t.colors.primary;
  const bg = background ?? t.colors.primarySoft;
  const inner = size * 0.64;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' },
        style,
      ]}
    >
      <Svg width={inner} height={inner} viewBox="0 0 64 64">
        {/* thin outer ring */}
        <Circle cx="32" cy="32" r="29" fill="none" stroke={c} strokeWidth={1.6} opacity={0.35} />
        {/* 8-point star = diamond square + axis-aligned square, outlined */}
        <Path d="M32 10 L54 32 L32 54 L10 32 Z" fill="none" stroke={c} strokeWidth={2} strokeLinejoin="round" />
        <Path d="M17 17 H47 V47 H17 Z" fill="none" stroke={c} strokeWidth={2} strokeLinejoin="round" />
        {/* filled diamond core */}
        <Path d="M32 24 L40 32 L32 40 L24 32 Z" fill={c} />
      </Svg>
    </View>
  );
});
