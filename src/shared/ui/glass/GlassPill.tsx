import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import { GlassSurface } from './GlassSurface';

export type GlassPillProps = {
  children: ReactNode;
  tone?: 'regular' | 'clear';
  tintColor?: string;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

/** A horizontal Liquid-Glass capsule for grouped floating controls (e.g. a segmented row or a
 *  cluster of actions). Content stays in a padded row; the glass is the wrapper. */
export function GlassPill({ children, tone = 'regular', tintColor, style, contentStyle }: GlassPillProps) {
  const t = useTheme();
  return (
    <GlassSurface tone={tone} tintColor={tintColor} radius={t.radius.full} style={style}>
      <View style={[{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: t.spacing.sm, paddingVertical: 6, gap: t.spacing.xs }, contentStyle]}>
        {children}
      </View>
    </GlassSurface>
  );
}
