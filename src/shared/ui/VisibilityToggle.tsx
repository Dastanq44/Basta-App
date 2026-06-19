import { Switch, View, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { useTheme } from './theme';

export type VisibilityToggleProps = {
  /** Controlled on/off state. */
  value: boolean;
  onValueChange: (next: boolean) => void;
  /** Bold primary line, e.g. "Private profile" or "Hide from profile and Global". */
  title: string;
  /** Muted helper line explaining what turning this on does. */
  description?: string;
  disabled?: boolean;
  style?: ViewStyle;
};

/**
 * Labelled native Switch row — the control used for the "private/hide" toggles on Edit Profile,
 * Group create/edit, and Challenge create/edit (the simplified visibility model). Submissions have
 * no visibility toggle. Purely presentational + controlled.
 */
export function VisibilityToggle({
  value,
  onValueChange,
  title,
  description,
  disabled = false,
  style,
}: VisibilityToggleProps) {
  const t = useTheme();
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, opacity: disabled ? 0.5 : 1 },
        style,
      ]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontWeight: '700', fontSize: t.fontSize.md, color: t.colors.foreground }}>{title}</Text>
        {description ? (
          <Text variant="caption" style={{ color: t.colors.mutedForeground }}>
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityLabel={title}
        trackColor={{ false: t.colors.muted, true: t.colors.primary }}
        thumbColor={t.colors.card}
        ios_backgroundColor={t.colors.muted}
      />
    </View>
  );
}
