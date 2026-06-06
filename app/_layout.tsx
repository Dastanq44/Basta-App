import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from '@/shared/lib/queryClient';
import { HeaderBackButton, ThemeProvider, useTheme, useThemeMode } from '@/shared/ui';
import { isAtTarget, useOnboardingGate } from '@/navigation/guards';
import { initOffline } from '@/offline';

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
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ThemedStatusBar />
          <RootNav />
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

// Status bar content color follows the resolved theme (manual override aware, not just the OS).
function ThemedStatusBar() {
  const { scheme } = useThemeMode();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}

// HeaderBackButton lives in src/shared/ui/ScreenHeader.tsx — same component is used
// both as the native-stack `headerLeft` here AND inside the custom in-body ScreenHeader
// on screens where the native UINavigationBar's bar-button highlight is undesirable.

function RootNav() {
  const t = useTheme();
  const gate = useOnboardingGate();
  const segments = useSegments() as string[];
  const router = useRouter();

  useEffect(() => {
    if (gate.status !== 'ready') return;
    if (!isAtTarget(segments, gate.target)) {
      router.replace(gate.target);
    }
  }, [gate, segments, router]);

  if (gate.status === 'loading') {
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

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Replace the native back chevron + tap-tint with a custom Pressable that
        // dims via opacity (no system color flash / white-circle tap highlight).
        // Both options below keep the back-text invisible: headerBackTitle: '' is the
        // older API, headerBackButtonDisplayMode: 'minimal' is the newer one. They're
        // belt-and-suspenders against version differences.
        headerBackTitle: '',
        headerBackButtonDisplayMode: 'minimal',
        headerLeft: ({ canGoBack }) =>
          canGoBack ? <HeaderBackButton onPress={() => router.back()} /> : null,
        // Match the header bar background to the SCREEN background so there's no
        // contrasting white strip behind the buttons (which read as "the buttons are
        // sitting in white circles" on phones). Also kill the iOS hairline shadow.
        headerStyle: { backgroundColor: t.colors.background },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(onboarding)" />
      {/* challenge/[id] + group/[id] render their OWN in-screen header (ScreenHeader)
          because the native UINavigationBar's bar-button system tap-highlight (a small
          circular tint behind the back / 3-dot icons that fades during transitions)
          can't be disabled through React Navigation options. */}
      <Stack.Screen name="challenge/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="challenge/new" options={{ headerShown: true, title: 'New challenge' }} />
      <Stack.Screen
        name="challenge/[id]/submit-proof"
        options={{ headerShown: true, presentation: 'modal', title: 'Submit proof' }}
      />
      <Stack.Screen
        name="challenge/[id]/edit-proof"
        options={{ headerShown: true, presentation: 'modal', title: 'Edit proof' }}
      />
      <Stack.Screen
        name="challenge/[id]/edit"
        options={{ headerShown: true, presentation: 'modal', title: 'Edit challenge' }}
      />
      <Stack.Screen name="verify/[submissionId]" options={{ headerShown: true, title: 'Verify proof' }} />
      <Stack.Screen name="group/[id]" options={{ headerShown: false }} />
      <Stack.Screen
        name="group/[id]/edit"
        options={{ headerShown: true, presentation: 'modal', title: 'Edit group' }}
      />
      <Stack.Screen
        name="group/join-or-create"
        options={{ headerShown: true, presentation: 'modal', title: 'New group' }}
      />
      <Stack.Screen name="group/archived" options={{ headerShown: true, title: 'Archived groups' }} />
      <Stack.Screen name="submission/[id]" options={{ headerShown: true, title: 'Proof' }} />
      <Stack.Screen name="blocked-users" options={{ headerShown: true, title: 'Blocked users' }} />
      <Stack.Screen name="verifications" options={{ headerShown: true, title: 'Verify proofs' }} />
      <Stack.Screen name="profile/edit" options={{ headerShown: true, presentation: 'modal', title: 'Edit profile' }} />
      <Stack.Screen name="profile/appearance" options={{ headerShown: true, title: 'Appearance' }} />
    </Stack>
  );
}
