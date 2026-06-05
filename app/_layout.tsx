import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from '@/shared/lib/queryClient';
import { ThemeProvider, useTheme, useThemeMode } from '@/shared/ui';
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
        // Drop the iOS back-button TEXT (was showing "(tabs)" / previous route name).
        // Per-screen `Stack.Screen` titles still set the centered header title.
        // `headerBackButtonDisplayMode: 'minimal'` is the supported newer API for
        // hiding the back-text on RN-screens stack headers.
        headerBackTitle: '',
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="challenge/[id]" options={{ headerShown: true, title: 'Challenge' }} />
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
      <Stack.Screen name="group/[id]" options={{ headerShown: true, title: 'Group' }} />
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
