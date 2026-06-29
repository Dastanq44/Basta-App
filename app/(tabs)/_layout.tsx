import { useEffect, useRef } from 'react';
import { Animated, Platform, View } from 'react-native';
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

/**
 * Tab icon in a primary-tinted lozenge when active. The pill is slightly LARGER and animates its
 * scale from the CENTER on focus (the indicator grows/shrinks toward the middle, per the user's
 * request) — this is the custom-owned fallback bar, so we control the motion here.
 *
 * NOTE: on the iOS 26 NATIVE tab bar (`NativeTabs`) the slider/minimize geometry + collapse origin
 * are OWNED by UIKit and not exposed by the API, so we keep the native `minimizeBehavior` there
 * rather than fighting the OS — the center-origin grow only applies to this fallback bar.
 */
function TabIcon({ name, color, focused }: { name: IconName; color: string; focused: boolean }) {
  const t = useTheme();
  const scale = useRef(new Animated.Value(focused ? 1 : 0.7)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: focused ? 1 : 0.7, useNativeDriver: true, speed: 30, bounciness: 9 }).start();
  }, [focused, scale]);

  return (
    <View style={{ width: 64, height: 34, alignItems: 'center', justifyContent: 'center' }}>
      {/* Lozenge scales from the center (transform origin is the view center). */}
      <Animated.View
        style={{
          position: 'absolute',
          width: 64,
          height: 34,
          borderRadius: t.radius.full,
          backgroundColor: t.colors.primarySoft,
          opacity: focused ? 1 : 0,
          transform: [{ scale }],
        }}
      />
      <Icon name={name} color={color} size={22} />
    </View>
  );
}
