import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { isLiquidGlassAvailable } from 'expo-glass-effect';

/**
 * Whether the real iOS 26 Liquid Glass effect is available on this device. False on Android and
 * older iOS — those fall back to expo-blur + themed surfaces. Cheap + safe to call anywhere.
 */
export function isGlassAvailable(): boolean {
  try {
    return Platform.OS === 'ios' && isLiquidGlassAvailable();
  } catch {
    return false;
  }
}

/** Tracks the OS "Reduce Transparency" accessibility setting (iOS). When on, glass surfaces render
 *  as solid themed surfaces for legibility. */
export function useReduceTransparency(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceTransparencyEnabled?.()
      .then((v) => active && setReduce(!!v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceTransparencyChanged', (v: boolean) => setReduce(!!v));
    return () => {
      active = false;
      sub?.remove?.();
    };
  }, []);
  return reduce;
}

export type GlassMode = 'liquid' | 'blur' | 'solid';

/** Resolves how a glass surface should render: real Liquid Glass, a blur fallback, or (when Reduce
 *  Transparency is on) a solid themed surface. */
export function useGlassMode(): GlassMode {
  const reduce = useReduceTransparency();
  if (reduce) return 'solid';
  return isGlassAvailable() ? 'liquid' : 'blur';
}
