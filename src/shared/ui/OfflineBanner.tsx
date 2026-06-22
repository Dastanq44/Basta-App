import { useNetInfo } from '@react-native-community/netinfo';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InlineBanner } from './InlineBanner';
import { useTheme } from './theme';

/** Global "you're offline" bar. Mounted once above the navigation shell; renders nothing while
 *  online so it only shifts layout when actually offline. Queued proofs drain via the offline
 *  queue when connectivity returns (D-004). */
export function OfflineBanner() {
  const t = useTheme();
  const net = useNetInfo();
  const insets = useSafeAreaInsets();
  // Only show when explicitly offline (the values are null until the first probe resolves).
  const offline = net.isConnected === false || net.isInternetReachable === false;
  if (!offline) return null;
  return (
    <View
      style={{
        paddingTop: insets.top,
        paddingHorizontal: t.spacing.md,
        paddingBottom: t.spacing.xs,
        backgroundColor: t.colors.background,
      }}
    >
      <InlineBanner
        tone="warning"
        title="You're offline"
        message="Queued proofs will upload automatically when you're back online."
      />
    </View>
  );
}
