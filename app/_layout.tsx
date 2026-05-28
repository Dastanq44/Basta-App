import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { queryClient } from '@/shared/lib/queryClient';
import { ThemeProvider, useTheme } from '@/shared/ui';
import { isAtTarget, useOnboardingGate } from '@/navigation/guards';

// Root layout = providers + root stack. Thin: composition + provider wiring only (D-002).
// The session+onboarding gate lives in <RootNav> so it can read the theme + run inside
// QueryClientProvider. All routing decisions are in `src/navigation/guards.ts`.
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <StatusBar style="auto" />
          <RootNav />
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
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
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="challenge/[id]" options={{ headerShown: true, title: 'Challenge' }} />
    </Stack>
  );
}
