import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useSession } from '@/features/auth';
import { ProfileScreen } from '@/features/profile';

// Read-only profile for another user. Thin wrapper around the shared <ProfileScreen>. The native
// stack header (registered in app/_layout.tsx) provides the back button + title.
export default function UserProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession();
  const myUid = session.session?.user.id;

  // Landing on your own id → bounce to the canonical Profile tab (one place to edit your data).
  if (id && myUid && id === myUid) {
    router.replace('/(tabs)/profile' as Href);
    return null;
  }
  if (!id) return null;

  return <ProfileScreen userId={id} />;
}
