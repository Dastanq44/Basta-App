// Push notifications service — T-050A slice.
//
// SCOPE: client-side registration only. Asks for permission, fetches the Expo push
// token via expo-notifications, and stores it in `push_tokens` on the server via the
// SECURITY DEFINER `register_push_token` RPC. There is NO server-side dispatch yet —
// that lands in T-050B (Edge Function + outbox + triggers).
//
// SAFETY: every failure mode no-ops with a console.info / .warn. Calling code should
// treat a null return as "we have no token to use yet" and continue. The bootstrap
// hook never blocks UI or routing — push registration is best-effort.
//
// SUPPORTED ENVIRONMENTS:
//   * EAS dev build / production / preview build on a physical device → token fetched.
//   * Expo Go → bails silently (push registration is unsupported in Expo Go under the
//     new architecture). Users running in Expo Go can still use the app; they just
//     don't receive push notifications.
//   * iOS simulator / Android emulator → bails silently (no push token APIs on sims).
//   * Missing EAS projectId → bails silently. Set the projectId by running
//     `npx eas init` once for the project; expo-constants resolves it on next launch.
//   * Permission denied → bails silently after the prompt.
//   * Token-fetch network error → bails silently with a warning log.

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/shared/lib/supabase';

export type PushPlatform = 'ios' | 'android' | 'web';

export interface PushService {
  /** Idempotent. Returns the Expo push token on success, null on any no-op path. */
  registerForPush(): Promise<string | null>;
  /** Unregisters a previously-issued token. Safe to call with null. */
  unregister(token?: string | null): Promise<void>;
}

/** Expo Go has historically not supported push registration under the new architecture.
 *  Constants.appOwnership === 'expo' identifies the Expo Go runtime. */
function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

/** EAS projectId resolution. Both shapes are common across recent SDKs. */
function getProjectId(): string | null {
  const fromExpoConfig =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  const fromEasConfig = (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig
    ?.projectId;
  return fromExpoConfig ?? fromEasConfig ?? null;
}

function platformCode(): PushPlatform | null {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'web') return 'web';
  return null;
}

function describeDevice(): string {
  const model = Device.modelName ?? Device.deviceName ?? Platform.OS;
  return model;
}

export const push: PushService = {
  async registerForPush() {
    if (isExpoGo()) {
      console.info('[basta] push.register: Expo Go detected — skipping (use an EAS dev build).');
      return null;
    }

    if (!Device.isDevice) {
      console.info('[basta] push.register: simulator/emulator — skipping.');
      return null;
    }

    const projectId = getProjectId();
    if (!projectId) {
      console.info(
        '[basta] push.register: missing EAS projectId — skipping. Run `npx eas init` and rebuild.',
      );
      return null;
    }

    const platform = platformCode();
    if (!platform) {
      console.info('[basta] push.register: unknown platform — skipping.');
      return null;
    }

    try {
      const existing = await Notifications.getPermissionsAsync();
      let granted = existing.status === 'granted';
      if (!granted) {
        const req = await Notifications.requestPermissionsAsync();
        granted = req.status === 'granted';
      }
      if (!granted) {
        console.info('[basta] push.register: permission denied.');
        return null;
      }

      // Android requires a notification channel before the token fetch. The default
      // channel created here is used when no channel is specified by a sent message.
      if (platform === 'android') {
        try {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        } catch (e) {
          console.warn(
            '[basta] push.register: setNotificationChannelAsync failed:',
            e instanceof Error ? e.message : e,
          );
        }
      }

      let token: string | null = null;
      try {
        const result = await Notifications.getExpoPushTokenAsync({ projectId });
        token = result.data || null;
      } catch (e) {
        console.warn(
          '[basta] push.register: getExpoPushTokenAsync failed:',
          e instanceof Error ? e.message : e,
        );
        return null;
      }

      if (!token) {
        console.info('[basta] push.register: getExpoPushTokenAsync returned empty.');
        return null;
      }

      const { error } = await supabase.rpc('register_push_token', {
        p_token: token,
        p_platform: platform,
        p_device_name: describeDevice(),
      });
      if (error) {
        console.warn('[basta] push.register: server rejected token:', error.message);
        return null;
      }
      return token;
    } catch (e) {
      console.warn('[basta] push.register failed:', e instanceof Error ? e.message : e);
      return null;
    }
  },

  async unregister(token) {
    if (!token) return;
    try {
      const { error } = await supabase.rpc('unregister_push_token', { p_token: token });
      if (error) {
        console.warn('[basta] push.unregister: server error:', error.message);
      }
    } catch (e) {
      console.warn('[basta] push.unregister failed:', e instanceof Error ? e.message : e);
    }
  },
};
