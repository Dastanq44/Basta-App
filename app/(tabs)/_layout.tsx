import { StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Icon, useTheme } from '@/shared/ui';

// Bottom tab shell: Today · Challenges · Groups · Profile (docs/architecture/NAVIGATION.md).
// Headers are rendered in-screen (custom greeting/title rows) — native header is off.
export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.colors.primary,
        tabBarInactiveTintColor: t.colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: t.colors.card,
          borderTopColor: t.colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Today', tabBarIcon: ({ color }) => <Icon name="home" color={color} size={22} /> }}
      />
      <Tabs.Screen
        name="challenges"
        options={{ title: 'Challenges', tabBarIcon: ({ color }) => <Icon name="tasks" color={color} size={22} /> }}
      />
      <Tabs.Screen
        name="groups"
        options={{ title: 'Groups', tabBarIcon: ({ color }) => <Icon name="groups" color={color} size={22} /> }}
      />
      <Tabs.Screen
        name="explore"
        options={{ title: 'Global', tabBarIcon: ({ color }) => <Icon name="explore" color={color} size={22} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color }) => <Icon name="profile" color={color} size={22} /> }}
      />
    </Tabs>
  );
}
