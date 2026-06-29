import Svg, { Path } from 'react-native-svg';
import { useTheme } from './theme';

export type CrownIconProps = {
  /** Square box size in px. Default 14. */
  size?: number;
  /** Override color. Defaults to the theme's primary so the leader badge reads as an accent. */
  color?: string;
};

/**
 * A simple, clean crown — one filled SVG path (three peaks + a base bar). Replaces the older
 * multi-`View` "peaks + gem dots" build, which read as fussy at small sizes (the user asked for a
 * simpler glyph). Defaults to the theme primary so it stays an accent in every theme.
 */
export function CrownIcon({ size = 14, color }: CrownIconProps) {
  const t = useTheme();
  const fill = color ?? t.colors.primary;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityLabel="Group leader">
      {/* Three-peak crown with a solid base — a single clean silhouette. */}
      <Path
        d="M3 8 L7.5 11.5 L12 5 L16.5 11.5 L21 8 L19.3 17 H4.7 Z M5 19.5 H19 V21 H5 Z"
        fill={fill}
      />
    </Svg>
  );
}
