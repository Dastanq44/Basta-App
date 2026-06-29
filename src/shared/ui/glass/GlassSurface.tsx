import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView } from 'expo-glass-effect';
import { useTheme } from '../theme';
import { useGlassMode } from './glassSupport';

export type GlassSurfaceProps = {
  children?: ReactNode;
  /** 'regular' = frostier (default, good behind controls); 'clear' = lighter, more transparent. */
  tone?: 'regular' | 'clear';
  /** Corner radius (defaults to the pill/full radius — glass loves concentric rounded geometry). */
  radius?: number;
  /** Optional brand tint applied to the glass (e.g. a primary-tinted active control). */
  tintColor?: string;
  /** Draw the hairline specular border. Default true. */
  bordered?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * The core Liquid-Glass surface. Renders, in order of capability:
 *  - iOS 26+: a real `GlassView` (Liquid Glass);
 *  - other iOS / Android: an `expo-blur` BlurView + a theme tint overlay;
 *  - Reduce Transparency on: a solid themed surface (no blur) for legibility.
 * Used for NAVIGATION + CONTROLS only — content cards stay solid (readability first).
 */
export function GlassSurface({ children, tone = 'regular', radius, tintColor, bordered = true, style }: GlassSurfaceProps) {
  const t = useTheme();
  const mode = useGlassMode();
  const r = radius ?? t.radius.full;
  const border = bordered ? { borderWidth: StyleSheet.hairlineWidth, borderColor: t.glass.border + '55' } : null;
  const common: StyleProp<ViewStyle> = [{ borderRadius: r, overflow: 'hidden' }, border, style];

  if (mode === 'liquid') {
    return (
      <GlassView
        glassEffectStyle={tone}
        tintColor={tintColor}
        style={[{ borderRadius: r }, border, style]}
      >
        {children}
      </GlassView>
    );
  }

  if (mode === 'blur') {
    const intensity = tone === 'clear' ? 22 : 38;
    // Overlay alpha: a tinted (active) control reads stronger; an inactive 'clear' control gets only
    // a whisper of tint so light themes don't render a muddy grey disc (the reported darkening).
    const overlayBase = tintColor ?? t.glass.tint;
    const overlayAlpha = tintColor ? '55' : tone === 'clear' ? (t.isDark ? '2E' : '24') : t.isDark ? '40' : '3A';
    return (
      <BlurView intensity={intensity} tint={t.glass.blurTint} style={common}>
        {/* A subtle theme tint over the blur keeps brand identity + contrast across all 4 themes. */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: overlayBase + overlayAlpha }]} />
        {children}
      </BlurView>
    );
  }

  // solid (Reduce Transparency) — opaque themed surface, no blur.
  return (
    <View style={[common, { backgroundColor: tintColor ?? t.colors.card }]}>
      {children}
    </View>
  );
}
