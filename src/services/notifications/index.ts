// Push notifications service — T-050A slice (refined).
//
// SCOPE: client-side registration ONLY. Asks for permission, fetches the Expo push
// token via expo-notifications, stores it in `push_tokens` on the server via the
// SECURITY DEFINER `register_push_token` RPC, and caches it locally in SecureStore
// (key `basta.push.lastToken`, value `{ token, userId }`) so we can:
//   1. Avoid redundant server upserts when the same user re-opens the app.
//   2. Re-register on user-switch (sign in as a different user on the same device).
//   3. Unregister the right token on sign-out without going through the server again.
//
// There is NO server-side dispatch here — that lands in T-050B (Edge Function +
// outbox + triggers + pg_cron). The mobile client NEVER sends pushes.
//
// SAFETY: every failure mode no-ops with a console log; the bootstrap call never
// throws. Bootstrap is fire-and-forget — push registration is best-effort.
//
// SUPPORTED ENVIRONMENTS:
//   * EAS dev / preview / production build on a physical device → token fetched.
//   * Expo Go → bails silently (registration unsupported under the new arch).
//   * Simulator / emulator → bails silently.
//   * Missing EAS projectId → bails silently. Run `npx eas init` once.
//   * Permission denied → bails silently.
//   * Network / token-fetch errors → bails silently with a warning.

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '@/shared/lib/supabase';

export type PushPlatform = 'ios' | 'android' | 'web';

/** SecureStore key holding the JSON `{ token, userId }` of the last successfully
 *  registered token. Reading it on bootstrap is how we decide whether the current user
 *  needs a fresh registration. */
const TOKEN_CACHE_KEY = 'basta.push.lastToken';

type CachedToken = {
  token: string;
  /** auth.uid of the user that owned the token when it was stored. */
  userId: string;
};

export interface PushService {
  /**
   * Idempotent per (current user, current device). Reads the SecureStore cache; if the
   * cached entry already matches the current signed-in user, no server call is made.
   * On user switch or first-time registration, fetches the token, calls the server RPC,
   * and writes the new cache entry. Returns the token on success, null otherwise.
   *
   * `currentUserId` is required so the service can compare against the cache without
   * having to call supabase.auth.getUser() itself (which can race the session refresh
   * during sign-in/out transitions).
   */
  registerForPush(currentUserId: string): Promise<string | null>;
  /**
   * Unregisters the LAST cached token from the server (soft-revoke via the RPC). Reads
   * the cache itself — caller doesn't need to pass the token. Safe to call when not
   * signed in (will no-op cleanly). MUST be called BEFORE `supabase.auth.signOut()` so
   * the RPC's `auth.uid()` resolves to the owner.
   */
  unregisterCurrent(): Promise<void>;
  /** Reads the cached token without side effects. Useful for tests / debug screens. */
  cachedToken(): Promise<CachedToken | null>;
}

function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

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
  return Device.modelName ?? Device.deviceName ?? Platform.OS;
}

async function readCache(): Promise<CachedToken | null> {
  try {
    const raw = await SecureStore.getItemAsync(TOKEN_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedToken>;
    if (!parsed.token || !parsed.userId) return null;
    return { token: parsed.token, userId: parsed.userId };
  } catch (e) {
    console.warn('[basta] push.cache.read failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

async function writeCache(entry: CachedToken): Promise<void> {
  try {
    await SecureStore.setItemAsync(TOKEN_CACHE_KEY, JSON.stringify(entry));
  } catch (e) {
    console.warn('[basta] push.cache.write failed:', e instanceof Error ? e.message : e);
  }
}

async function clearCache(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_CACHE_KEY);
  } catch (e) {
    console.warn('[basta] push.cache.clear failed:', e instanceof Error ? e.message : e);
  }
}

export const push: PushService = {
  async registerForPush(currentUserId: string) {
    if (!currentUserId) {
      console.info('[basta] push.register: no current userId — skipping');
      return null;
    }

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

    // User-aware short-circuit: if we've already registered a token for THIS user from
    // this device, skip the server round-trip. The RPC upsert is cheap but we'd burn a
    // network call on every cold start otherwise.
    const cached = await readCache();
    if (cached && cached.userId === currentUserId) {
      // Same user, same device — token is fresh until they sign out or the device
      // re-installs (which invalidates the SecureStore entry).
      return cached.token;
    }

    // If a different user owns the cache, soft-revoke their token before reusing the
    // device for the new user. We use the OLD cached identity here, but the RPC is
    // SECURITY DEFINER and authorizes against auth.uid() — which is now the NEW user.
    // So strictly speaking we can only mark the row revoked under the new user; the
    // server-side register_push_token below also reassigns user_id on conflict, which
    // is the real "transfer" mechanism. The revoke here is defense-in-depth for the
    // edge case where the new user signs in but the upsert fails.
    if (cached && cached.userId !== currentUserId) {
      // Don't await — best-effort, never blocks the re-registration path.
      void supabase.rpc('unregister_push_token', { p_token: cached.token });
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

      await writeCache({ token, userId: currentUserId });
      return token;
    } catch (e) {
      console.warn('[basta] push.register failed:', e instanceof Error ? e.message : e);
      return null;
    }
  },

  async unregisterCurrent() {
    const cached = await readCache();
    if (!cached) return;
    try {
      const { error } = await supabase.rpc('unregister_push_token', { p_token: cached.token });
      if (error) {
        console.warn('[basta] push.unregister: server error:', error.message);
      }
    } catch (e) {
      console.warn('[basta] push.unregister failed:', e instanceof Error ? e.message : e);
    }
    await clearCache();
  },

  async cachedToken() {
    return readCache();
  },
};
