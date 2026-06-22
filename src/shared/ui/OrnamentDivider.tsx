import { memo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from './theme';

export type OrnamentDividerProps = {
  /** Motif + line color. Defaults to the gold accent. */
  color?: string;
  /** Width of the centered motif in px (line flanks fill the rest). */
  motifSize?: number;
  style?: ViewStyle;
};

/**
 * A hairline divider with a small centered qoshqar-müyiz (ram's-horn) motif — two opposing
 * curls around a diamond. Used between sections / as a hero accent. Deliberately subtle:
 * never place it behind text or repeat it as a background (see CLAUDE.md redesign brief).
 */
export const OrnamentDivider = memo(function OrnamentDivider({ color, motifSize = 30, style }: OrnamentDividerProps) {
  const t = useTheme();
  const c = color ?? t.colors.accent;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }, style]}
    >
      <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: t.colors.border }} />
      <Svg width={motifSize} height={motifSize * 0.46} viewBox="0 0 52 24">
        {/* central diamond */}
        <Path d="M26 5 L31 12 L26 19 L21 12 Z" fill={c} />
        {/* opposing ram-horn curls */}
        <Path d="M20 12 C12 12 13 5 6 6 C11 8 9 12 16 12" fill="none" stroke={c} strokeWidth={1.7} strokeLinecap="round" />
        <Path d="M32 12 C40 12 39 5 46 6 C41 8 43 12 36 12" fill="none" stroke={c} strokeWidth={1.7} strokeLinecap="round" />
      </Svg>
      <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: t.colors.border }} />
    </View>
  );
});
