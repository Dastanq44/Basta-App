import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useSession } from '@/features/auth';
import { queryClient } from '@/shared/lib/queryClient';
import { ThemeProvider, useTheme } from '@/shared/ui';

// Root layout = providers + root stack. Thin: composition + provider wiring only (D-002).
// The session gate lives in <RootNav> so it can read the theme + run inside QueryClientProvider.
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
  const session = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (session.status === 'loading') return;
    const inAuthGroup = segments[0] === '(auth)';
    if (session.status === 'signedOut' && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (session.status === 'signedIn' && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session.status, segments, router]);

  if (session.status === 'loading') {
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
