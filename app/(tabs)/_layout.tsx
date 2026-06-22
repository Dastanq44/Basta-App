import { Platform, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Icon, useTheme } from '@/shared/ui';
import type { IconName } from '@/shared/ui';
import { useI18n } from '@/shared/i18n';

// Bottom tab shell: Today · Challenges · Groups · Global · Profile (docs/architecture/NAVIGATION.md).
// Headers are rendered in-screen — native header is off. The bar reads as a soft floating card
// (rounded top, upward lift, no hard hairline) with a primary-tinted pill behind the active icon.
export default function TabsLayout() {
  const t = useTheme();
  const { t: tr } = useI18n();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.colors.primary,
        tabBarInactiveTintColor: t.colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: t.colors.card,
          borderTopWidth: 0,
          borderTopLeftRadius: t.radius.xl,
          borderTopRightRadius: t.radius.xl,
          paddingTop: 8,
          // Upward soft lift so the bar reads as a floating card edge (iOS shadow + Android elevation).
          ...Platform.select({
            ios: { shadowColor: '#0A2540', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: -6 } },
            android: { elevation: 16 },
            default: {},
          }),
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: tr('nav.today'), tabBarIcon: ({ color, focused }) => <TabIcon name="home" color={color} focused={focused} /> }}
      />
      <Tabs.Screen
        name="challenges"
        options={{ title: tr('nav.challenges'), tabBarIcon: ({ color, focused }) => <TabIcon name="tasks" color={color} focused={focused} /> }}
      />
      <Tabs.Screen
        name="groups"
        options={{ title: tr('nav.groups'), tabBarIcon: ({ color, focused }) => <TabIcon name="groups" color={color} focused={focused} /> }}
      />
      <Tabs.Screen
        name="explore"
        options={{ title: tr('nav.global'), tabBarIcon: ({ color, focused }) => <TabIcon name="globe" color={color} focused={focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: tr('nav.profile'), tabBarIcon: ({ color, focused }) => <TabIcon name="profile" color={color} focused={focused} /> }}
      />
    </Tabs>
  );
}

/** Tab icon wrapped in a primary-tinted lozenge when active — a clearer active state than tint alone. */
function TabIcon({ name, color, focused }: { name: IconName; color: string; focused: boolean }) {
  const t = useTheme();
  return (
    <View
      style={{
        width: 54,
        height: 30,
        borderRadius: t.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? t.colors.primarySoft : 'transparent',
      }}
    >
      <Icon name={name} color={color} size={22} />
    </View>
  );
}
