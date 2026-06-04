import { View } from 'react-native';
import { Icon, Screen, Text, useTheme } from '@/shared/ui';

// Explore tab — placeholder for now (post-MVP per DECISIONS D-006; thin placeholder allowed).
export default function ExploreScreen() {
  const t = useTheme();
  return (
    <Screen edges={['top']}>
      <Text variant="title">Explore</Text>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.spacing.md }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: t.colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="explore" size={36} color={t.colors.primary} />
        </View>
        <Text variant="heading">Coming soon</Text>
        <Text variant="muted" style={{ textAlign: 'center' }}>
          Discover public challenges and groups here.
        </Text>
      </View>
    </Screen>
  );
}
