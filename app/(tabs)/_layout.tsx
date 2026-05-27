import { Tabs } from 'expo-router';
import { useTheme } from '@/shared/ui';

// Bottom tab shell: Today · Challenges · Groups · Profile (docs/architecture/NAVIGATION.md).
// Icons are added with the design pass; titles keep the shell accessible in the meantime.
export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: t.colors.primary,
        tabBarInactiveTintColor: t.colors.mutedForeground,
        headerShown: true,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="challenges" options={{ title: 'Challenges' }} />
      <Tabs.Screen name="groups" options={{ title: 'Groups' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
