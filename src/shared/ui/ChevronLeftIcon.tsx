import Svg, { Path } from 'react-native-svg';
import { useTheme } from './theme';

export type ChevronLeftIconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

/**
 * A back chevron drawn as a proper SVG path — optically centered inside its box (the path is
 * nudged 1px right of the geometric center so the "<" reads as centered to the eye). Replaces the
 * old border-rotated View + per-screen marginLeft hacks. Inherits the theme foreground by default
 * and works in light/dark + glass/non-glass modes.
 */
export function ChevronLeftIcon({ size = 22, color, strokeWidth = 2.2 }: ChevronLeftIconProps) {
  const t = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14.5 5.5 L9 12 L14.5 18.5"
        stroke={color ?? t.colors.foreground}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
