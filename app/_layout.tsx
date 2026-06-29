import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { type Href, Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider, type Theme as NavTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from '@/shared/lib/queryClient';
import { SessionProvider, useSession } from '@/features/auth';
import { KeyboardDoneAccessory, OfflineBanner, ThemeProvider, useAppStackScreenOptions, useTheme, useThemeMode } from '@/shared/ui';
import { I18nProvider, useI18n } from '@/shared/i18n';
import { PreferencesGateProvider, usePreferencesGate } from '@/features/preferences';
import { isAtTarget, useOnboardingGate } from '@/navigation/guards';
import { initOffline } from '@/offline';
import { push } from '@/services/notifications';

// Root layout = providers + root stack. Thin: composition + provider wiring only (D-002).
// The session+onboarding gate lives in <RootNav> so it can read the theme + run inside
// QueryClientProvider. All routing decisions are in `src/navigation/guards.ts`.
export default function RootLayout() {
  // Open the SQLite DB once on app start, then wire the queue processor to NetInfo + AppState.
  // The processor handles its own auth checks per job, so starting it before sign-in is safe.
  useEffect(() => {
    let stop: (() => void) | undefined;
    initOffline()
      .then((teardown) => {
        stop = teardown;
      })
      .catch((e) => console.error('[basta] offline init failed:', e));
    return () => {
      stop?.();
    };
  }, []);

  return (
    <SafeAreaProvider>
      {/* One auth subscription for the whole app; every useSession() reads this context. */}
      <SessionProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <I18nProvider>
              <PreferencesGateProvider>
                <ThemedStatusBar />
                <RootNav />
                {/* Shared iOS "Done" bar above the keyboard. UIKit binds it to multiline
                    TextInputs by `nativeID`, so a single instance covers the whole app. */}
                <KeyboardDoneAccessory />
              </PreferencesGateProvider>
            </I18nProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}

// Status bar content color follows the resolved theme (manual override aware, not just the OS).
function ThemedStatusBar() {
  const { scheme } = useThemeMode();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}

// The shared native-header chrome (flat chevron back, centered themed title, transparent bar) lives
// in useAppStackScreenOptions() — applied to BOTH this root stack and the nested (auth) stack so the
// back/title controls are identical on every native-header screen.

function RootNav() {
  const t = useTheme();
  const { t: tr } = useI18n();
  const gate = useOnboardingGate();
  const prefsGate = usePreferencesGate();
  const segments = useSegments() as string[];
  const router = useRouter();
  const headerOptions = useAppStackScreenOptions();
  const session = useSession();

  const atPreferences = segments[0] === '(onboarding)' && segments[1] === 'preferences';

  useEffect(() => {
    // First-launch personalization takes precedence over the auth/onboarding gate. While the
    // completion flag hasn't loaded, do nothing (the loader below covers it).
    if (!prefsGate.ready) return;
    if (!prefsGate.completed) {
      if (!atPreferences) router.replace('/(onboarding)/preferences' as Href);
      return;
    }
    // Personalization done → normal auth/onboarding routing.
    if (gate.status !== 'ready') return;
    if (!isAtTarget(segments, gate.target)) {
      router.replace(gate.target);
    }
  }, [prefsGate, atPreferences, gate, segments, router]);

  // Push registration bootstrap (T-050A, refined). The service is user-aware: it
  // checks the SecureStore cache against `currentUserId` and only hits the server
  // when the cached entry is missing or owned by a different user. So firing this
  // effect on every (uid × target) change is safe + cheap. No useRef one-shot guard
  // — that broke the "user switch on the same device" case. Service no-ops on Expo
  // Go / simulator / missing projectId / denied permission, so the promise never
  // blocks navigation.
  const currentUserId = session.session?.user.id;
  useEffect(() => {
    if (gate.status !== 'ready' || gate.target !== '/(tabs)') return;
    if (!currentUserId) return;
    void push.registerForPush(currentUserId);
  }, [gate, currentUserId]);

  // Show the splash loader until the preferences flag has loaded, and (once personalization is
  // done) until the auth/onboarding gate resolves. When personalization is NOT done we fall
  // through to render the children so the preferences flow itself can show.
  if (!prefsGate.ready || (prefsGate.completed && gate.status === 'loading')) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: t.colors.background,
        }}
      >
        <ActivityIndicator color={t.colors.primary} />
      </View>
    );
  }

  // Bridge the active app theme to the native navigation system so native headers + native tabs
  // (and iOS 26 Liquid Glass surfaces) pick the correct light/dark appearance + brand colors —
  // fixes the light-theme flashing and the dark-theme black header text (D-018, B5/B6/B7).
  const navTheme: NavTheme = {
    ...(t.isDark ? DarkTheme : DefaultTheme),
    dark: t.isDark,
    colors: {
      ...(t.isDark ? DarkTheme : DefaultTheme).colors,
      primary: t.colors.primary,
      background: t.colors.background,
      card: t.colors.card,
      text: t.colors.foreground,
      border: t.colors.border,
      notification: t.colors.primary,
    },
  };

  return (
    <NavThemeProvider value={navTheme}>
    <View style={{ flex: 1, backgroundColor: t.colors.background }}>
      <OfflineBanner />
      <Stack
      // Native headers default OFF (screens opt in per route). The shared chrome — flat chevron
      // back, centered themed title, transparent bar — comes from useAppStackScreenOptions(), the
      // SAME hook the (auth) stack uses, so every native-header screen looks identical.
      screenOptions={{ headerShown: false, ...headerOptions }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(onboarding)" />
      {/* challenge/[id], group/[id] + submission/[id] use the NATIVE stack header — identical to the
          Archive page: the shared back chevron (global `headerLeft`) + a centered title, with the
          3-dot in `headerRight`. Each screen sets its dynamic title + headerRight via an inline
          <Stack.Screen options=…>. (Replaces the hand-rolled in-body glass circles, which read as
          squared boxes on device — see D-019.) */}
      <Stack.Screen name="challenge/[id]" options={{ headerShown: true }} />
      <Stack.Screen name="challenge/new" options={{ headerShown: true, title: tr('today.newChallenge') }} />
      <Stack.Screen
        name="challenge/[id]/submit-proof"
        options={{ headerShown: true, presentation: 'modal', title: tr('proof.submitTitle') }}
      />
      <Stack.Screen
        name="challenge/[id]/edit-proof"
        options={{ headerShown: true, presentation: 'modal', title: tr('proof.editTitle') }}
      />
      <Stack.Screen
        name="challenge/[id]/edit"
        options={{ headerShown: true, presentation: 'modal', title: tr('challenge.editChallenge') }}
      />
      <Stack.Screen name="verify/[submissionId]" options={{ headerShown: true, title: tr('verify.title') }} />
      <Stack.Screen name="group/[id]" options={{ headerShown: true }} />
      <Stack.Screen
        name="group/[id]/edit"
        options={{ headerShown: true, presentation: 'modal', title: tr('groupForm.editTitle') }}
      />
      <Stack.Screen
        name="group/join-or-create"
        options={{ headerShown: true, presentation: 'modal', title: tr('groups.newGroup') }}
      />
      <Stack.Screen name="group/archived" options={{ headerShown: true, title: tr('groups.archived') }} />
      <Stack.Screen name="submission/[id]" options={{ headerShown: true }} />
      <Stack.Screen name="user/[id]" options={{ headerShown: true, title: tr('nav.profile') }} />
      <Stack.Screen name="blocked-users" options={{ headerShown: true, title: tr('blocked.title') }} />
      <Stack.Screen name="verifications" options={{ headerShown: true, title: tr('verify.titlePlural') }} />
      <Stack.Screen name="profile/edit" options={{ headerShown: true, presentation: 'modal', title: tr('profileEdit.title') }} />
      <Stack.Screen name="profile/preferences" options={{ headerShown: true, title: tr('settings.languageTheme') }} />
      </Stack>
    </View>
    </NavThemeProvider>
  );
}
