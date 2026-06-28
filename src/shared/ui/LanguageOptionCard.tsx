import { Pressable, View, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { useTheme } from './theme';

export type LanguageOptionCardProps = {
  /** Native name, e.g. "Қазақша". */
  title: string;
  /** Secondary descriptor, e.g. "Kazakh". */
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  style?: ViewStyle;
};

/** A large, tappable language choice row with a radio indicator. Shared by the first-launch flow
 *  and the preferences screen. Meets the 44pt tap target. */
export function LanguageOptionCard({ title, subtitle, selected, onPress, style }: LanguageOptionCardProps) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={title}
      onPress={onPress}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.spacing.md,
          padding: t.spacing.md,
          minHeight: t.minTapTarget + 12,
          borderRadius: t.radius.lg,
          borderWidth: 1.5,
          borderColor: selected ? t.colors.primary : t.colors.border,
          backgroundColor: selected ? t.colors.primarySoft : t.colors.card,
        },
        style,
      ]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="subtitle" style={{ color: selected ? t.colors.primary : t.colors.foreground }}>{title}</Text>
        {subtitle ? <Text variant="caption">{subtitle}</Text> : null}
      </View>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: 2,
          borderColor: selected ? t.colors.primary : t.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {selected ? <View style={{ width: 11, height: 11, borderRadius: 5.5, backgroundColor: t.colors.primary }} /> : null}
      </View>
    </Pressable>
  );
}
