import { Pressable, View } from 'react-native';
import { Text } from './Text';
import { useTheme } from './theme';

export type SegmentOption<T extends string> = { label: string; value: T };

export type SegmentedControlProps<T extends string> = {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

/** iOS-style segmented switch (the "Week / Month / All-time" sub-switcher in the reference). */
export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: t.colors.muted, borderRadius: t.radius.full, padding: 4, gap: 4 }}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(opt.value)}
            style={[
              { flex: 1, paddingVertical: 8, borderRadius: t.radius.full, alignItems: 'center', backgroundColor: active ? t.colors.card : 'transparent' },
              active ? t.shadow.sm : null,
            ]}
          >
            <Text style={{ color: active ? t.colors.foreground : t.colors.mutedForeground, fontWeight: active ? '700' : '500', fontSize: t.fontSize.sm }}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
