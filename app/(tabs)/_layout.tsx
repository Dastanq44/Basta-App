import { Platform, View } from 'react-native';
import { Tabs } from 'expo-router';
import { NativeTabs, Icon as NativeTabIcon, Label } from 'expo-router/unstable-native-tabs';
import { Icon, isGlassAvailable, useTheme } from '@/shared/ui';
import type { IconName } from '@/shared/ui';
import { useI18n } from '@/shared/i18n';

// Bottom tabs: Today · Challenges · Groups · Global · Profile (docs/architecture/NAVIGATION.md).
// iPhone-first Liquid Glass: on iOS 26 (Liquid Glass available) we render the NATIVE floating tab
// bar (translucent glass + minimize-on-scroll). Everywhere else we keep the refined floating JS
// tab bar (soft card + primary-tinted active pill) so Android / older iOS still look coherent.
export default function TabsLayout() {
  const { t: tr } = useI18n();

  if (Platform.OS === 'ios' && isGlassAvailable()) {
    return <NativeGlassTabs labels={{
      today: tr('nav.today'),
      challenges: tr('nav.challenges'),
      groups: tr('nav.groups'),
      global: tr('nav.global'),
      profile: tr('nav.profile'),
    }} />;
  }

  return <FallbackTabs />;
}

/** iOS 26 native Liquid Glass tab bar — SF Symbol icons, localized labels, minimize on scroll. */
function NativeGlassTabs({ labels }: { labels: { today: string; challenges: string; groups: string; global: string; profile: string } }) {
  const t = useTheme();
  return (
    <NativeTabs minimizeBehavior="onScrollDown" tintColor={t.colors.primary}>
      <NativeTabs.Trigger name="index">
        <NativeTabIcon sf="house.fill" />
        <Label>{labels.today}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="challenges">
        <NativeTabIcon sf="checklist" />
        <Label>{labels.challenges}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="groups">
        <NativeTabIcon sf="person.2.fill" />
        <Label>{labels.groups}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="explore">
        <NativeTabIcon sf="globe" />
        <Label>{labels.global}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabIcon sf="person.crop.circle.fill" />
        <Label>{labels.profile}</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

/** Cross-platform fallback — the refined floating JS tab bar (Android + iOS < 26). */
function FallbackTabs() {
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
          ...Platform.select({
            ios: { shadowColor: '#0A2540', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: -6 } },
            android: { elevation: 16 },
            default: {},
          }),
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: tr('nav.today'), tabBarIcon: ({ color, focused }) => <TabIcon name="home" color={color} focused={focused} /> }} />
      <Tabs.Screen name="challenges" options={{ title: tr('nav.challenges'), tabBarIcon: ({ color, focused }) => <TabIcon name="tasks" color={color} focused={focused} /> }} />
      <Tabs.Screen name="groups" options={{ title: tr('nav.groups'), tabBarIcon: ({ color, focused }) => <TabIcon name="groups" color={color} focused={focused} /> }} />
      <Tabs.Screen name="explore" options={{ title: tr('nav.global'), tabBarIcon: ({ color, focused }) => <TabIcon name="globe" color={color} focused={focused} /> }} />
      <Tabs.Screen name="profile" options={{ title: tr('nav.profile'), tabBarIcon: ({ color, focused }) => <TabIcon name="profile" color={color} focused={focused} /> }} />
    </Tabs>
  );
}

/** Tab icon wrapped in a primary-tinted lozenge when active — a clear active state for the fallback. */
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
