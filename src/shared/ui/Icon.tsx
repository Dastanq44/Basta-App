import { View } from 'react-native';
import { useTheme } from './theme';

// Dependency-free icon set — composed from RN primitives (same approach as CrownIcon),
// so we add no icon library. Simple line/solid glyphs sized to an s×s box.
export type IconName =
  | 'home'
  | 'tasks'
  | 'groups'
  | 'profile'
  | 'chevron'
  | 'plus'
  | 'bell'
  | 'search'
  | 'check'
  | 'copy'
  | 'explore'
  | 'globe'
  | 'flame'
  | 'settings';

export type IconProps = { name: IconName; size?: number; color?: string; strokeWidth?: number };

export function Icon({ name, size = 24, color, strokeWidth = 2 }: IconProps) {
  const t = useTheme();
  const c = color ?? t.colors.foreground;
  const sw = strokeWidth;
  const box = { width: size, height: size, alignItems: 'center', justifyContent: 'center' } as const;

  switch (name) {
    case 'home':
      return (
        <View style={box}>
          <View
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: size * 0.36,
              borderRightWidth: size * 0.36,
              borderBottomWidth: size * 0.3,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderBottomColor: c,
            }}
          />
          <View
            style={{ width: size * 0.5, height: size * 0.34, backgroundColor: c, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, marginTop: -1 }}
          />
        </View>
      );
    case 'tasks':
      return (
        <View style={box}>
          <View
            style={{ width: size * 0.62, height: size * 0.78, borderWidth: sw, borderColor: c, borderRadius: 5, paddingHorizontal: size * 0.12, justifyContent: 'center', gap: size * 0.1 }}
          >
            {[0, 1, 2].map((i) => (
              <View key={i} style={{ height: sw, backgroundColor: c, width: i === 2 ? '60%' : '100%', borderRadius: sw }} />
            ))}
          </View>
        </View>
      );
    case 'groups':
      return (
        <View style={[box, { flexDirection: 'row' }]}>
          <View style={{ width: size * 0.42, height: size * 0.42, borderRadius: size * 0.21, borderWidth: sw, borderColor: c, marginRight: -size * 0.12, backgroundColor: t.colors.card }} />
          <View style={{ width: size * 0.42, height: size * 0.42, borderRadius: size * 0.21, borderWidth: sw, borderColor: c, backgroundColor: t.colors.card }} />
        </View>
      );
    case 'profile':
      return (
        <View style={box}>
          <View style={{ width: size * 0.36, height: size * 0.36, borderRadius: size * 0.18, borderWidth: sw, borderColor: c }} />
          <View
            style={{ width: size * 0.62, height: size * 0.32, borderTopLeftRadius: size * 0.31, borderTopRightRadius: size * 0.31, borderWidth: sw, borderColor: c, borderBottomWidth: 0, marginTop: size * 0.06 }}
          />
        </View>
      );
    case 'chevron':
      return (
        <View style={box}>
          <View style={{ width: size * 0.32, height: size * 0.32, borderTopWidth: sw, borderRightWidth: sw, borderColor: c, transform: [{ rotate: '45deg' }] }} />
        </View>
      );
    case 'plus':
      return (
        <View style={box}>
          <View style={{ position: 'absolute', width: size * 0.62, height: sw, backgroundColor: c, borderRadius: sw }} />
          <View style={{ position: 'absolute', height: size * 0.62, width: sw, backgroundColor: c, borderRadius: sw }} />
        </View>
      );
    case 'bell':
      return (
        <View style={box}>
          <View style={{ width: size * 0.5, height: size * 0.46, borderWidth: sw, borderColor: c, borderTopLeftRadius: size * 0.25, borderTopRightRadius: size * 0.25, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 }} />
          <View style={{ width: size * 0.62, height: sw, backgroundColor: c, borderRadius: sw, marginTop: 1 }} />
          <View style={{ width: size * 0.1, height: size * 0.1, borderRadius: size * 0.05, backgroundColor: c, marginTop: 1 }} />
        </View>
      );
    case 'search':
      return (
        <View style={box}>
          <View style={{ width: size * 0.52, height: size * 0.52, borderRadius: size * 0.26, borderWidth: sw, borderColor: c, position: 'absolute', top: size * 0.1, left: size * 0.12 }} />
          <View style={{ width: sw, height: size * 0.26, backgroundColor: c, borderRadius: sw, position: 'absolute', bottom: size * 0.08, right: size * 0.14, transform: [{ rotate: '-45deg' }] }} />
        </View>
      );
    case 'check':
      return (
        <View style={box}>
          <View style={{ width: size * 0.5, height: size * 0.26, borderLeftWidth: sw, borderBottomWidth: sw, borderColor: c, transform: [{ rotate: '-45deg' }] }} />
        </View>
      );
    case 'copy':
      return (
        <View style={box}>
          <View style={{ width: size * 0.42, height: size * 0.5, borderWidth: sw, borderColor: c, borderRadius: 4, position: 'absolute', top: size * 0.1, left: size * 0.14 }} />
          <View style={{ width: size * 0.42, height: size * 0.5, borderWidth: sw, borderColor: c, borderRadius: 4, position: 'absolute', bottom: size * 0.1, right: size * 0.14, backgroundColor: t.colors.card }} />
        </View>
      );
    case 'explore':
      return (
        <View style={box}>
          <View style={{ width: size * 0.78, height: size * 0.78, borderRadius: size * 0.39, borderWidth: sw, borderColor: c, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: size * 0.28, height: size * 0.28, backgroundColor: c, transform: [{ rotate: '45deg' }] }} />
          </View>
        </View>
      );
    case 'globe':
      return (
        <View style={box}>
          <View style={{ width: size * 0.78, height: size * 0.78, borderRadius: size * 0.39, borderWidth: sw, borderColor: c, alignItems: 'center', justifyContent: 'center' }}>
            {/* equator */}
            <View style={{ position: 'absolute', width: size * 0.78, height: sw, backgroundColor: c }} />
            {/* meridian (narrow ellipse) */}
            <View style={{ width: size * 0.34, height: size * 0.78, borderRadius: size * 0.17, borderWidth: sw, borderColor: c }} />
          </View>
        </View>
      );
    case 'flame':
      return (
        <View style={box}>
          <View
            style={{
              width: size * 0.5,
              height: size * 0.6,
              backgroundColor: c,
              borderTopLeftRadius: size * 0.3,
              borderTopRightRadius: size * 0.04,
              borderBottomLeftRadius: size * 0.3,
              borderBottomRightRadius: size * 0.3,
              transform: [{ rotate: '45deg' }],
            }}
          />
        </View>
      );
    case 'settings': {
      // Three vertical dots — the universal "more / settings" affordance. Simple, mono,
      // 2D — fits the user's "monocolour, 2d shape, simple" brief better than a fiddly
      // multi-tooth gear silhouette at small sizes.
      const dot = size * 0.18;
      const gap = size * 0.06;
      return (
        <View style={box}>
          <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: c }} />
          <View style={{ height: gap }} />
          <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: c }} />
          <View style={{ height: gap }} />
          <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: c }} />
        </View>
      );
    }
    default:
      return null;
  }
}
