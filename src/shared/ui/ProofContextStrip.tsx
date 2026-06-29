import { Fragment } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { Text } from './Text';
import { useTheme } from './theme';

export type ProofContextItem = {
  key: string;
  /** Small uppercase eyebrow, e.g. "Author" / "Challenge" / "Group". */
  label: string;
  value: string;
  sub?: string;
  onPress?: () => void;
  /** When set, lead the row with an initials/image avatar instead of the eyebrow glyph. */
  avatarName?: string | null;
  avatarUri?: string | null;
  /** When set (and no avatar), lead the row with this emoji in a tinted tile (e.g. a challenge). */
  emoji?: string | null;
};

export type ProofContextStripProps = {
  items: ProofContextItem[];
  style?: ViewStyle;
};

/**
 * A single elegant context card for a proof — stacked, tappable rows (Author · Challenge ·
 * Group) with a leading avatar/glyph, an eyebrow label, the value, and a trailing chevron when
 * navigable. Replaces the old row of cramped equal-width boxes. Rows meet the 44pt tap target.
 */
export function ProofContextStrip({ items, style }: ProofContextStripProps) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.colors.card,
          borderRadius: t.radius.xl,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.colors.border,
          overflow: 'hidden',
        },
        t.shadow.sm,
        style,
      ]}
    >
      {items.map((item, i) => {
        const row = (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: t.spacing.md,
              paddingVertical: t.spacing.sm + 2,
              paddingHorizontal: t.spacing.md,
              minHeight: t.minTapTarget,
            }}
          >
            {item.avatarName !== undefined ? (
              <Avatar name={item.avatarName} uri={item.avatarUri ?? undefined} size={36} />
            ) : (
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: t.radius.md,
                  backgroundColor: t.colors.primarySoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {item.emoji ? (
                  <Text style={{ fontSize: 20 }}>{item.emoji}</Text>
                ) : (
                  <Text style={{ color: t.colors.primary, fontWeight: '800', fontSize: t.fontSize.xs }}>
                    {item.label.slice(0, 1).toUpperCase()}
                  </Text>
                )}
              </View>
            )}
            <View style={{ flex: 1, gap: 1 }}>
              <Text variant="label" style={{ color: t.colors.mutedForeground }}>{item.label.toUpperCase()}</Text>
              <Text variant="subtitle" numberOfLines={1}>{item.value}</Text>
              {item.sub ? <Text variant="caption">{item.sub}</Text> : null}
            </View>
            {item.onPress ? <Icon name="chevron" size={16} color={t.colors.mutedForeground} /> : null}
          </View>
        );
        return (
          <Fragment key={item.key}>
            {i > 0 ? <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.colors.border, marginLeft: t.spacing.md + 36 + t.spacing.md }} /> : null}
            {item.onPress ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.label}: ${item.value}`}
                onPress={item.onPress}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                {row}
              </Pressable>
            ) : (
              row
            )}
          </Fragment>
        );
      })}
    </View>
  );
}
