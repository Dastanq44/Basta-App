import { Link, Stack } from 'expo-router';
import { Screen, Text } from '@/shared/ui';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <Screen>
        <Text variant="title">This screen doesn&apos;t exist.</Text>
        <Link href="/">
          <Text variant="body" style={{ marginTop: 12 }}>Go to Today</Text>
        </Link>
      </Screen>
    </>
  );
}
