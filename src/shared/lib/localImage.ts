// Robust local-file reading for uploads. On React Native, `fetch(file://…)` / `fetch(content://…)`
// is flaky on some Android builds and content-provider URIs; expo-file-system reads both reliably.
// Shared by user-avatar and group-avatar uploads so the read strategy can't drift.
// SDK 54 / expo-file-system v19: the classic read API lives under the `/legacy` entry.
import * as FileSystem from 'expo-file-system/legacy';

/** base64 → bytes. `atob` is provided by Hermes (SDK 54) and typed via the DOM lib. */
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export type ReadLocalImageOptions = {
  /** Reject files larger than this many bytes (default 10 MB — generous for cropped avatars). */
  maxBytes?: number;
};

/**
 * Read a local image URI into bytes via expo-file-system (not `fetch`). Throws a plain Error on
 * a missing/empty/oversized file — callers that need typed errors (e.g. group avatar) wrap this.
 */
export async function readLocalImageBytes(localUri: string, opts: ReadLocalImageOptions = {}): Promise<Uint8Array> {
  const maxBytes = opts.maxBytes ?? 10 * 1024 * 1024;
  const info = await FileSystem.getInfoAsync(localUri);
  if (!info.exists) throw new Error('The selected image no longer exists on this device.');
  if (typeof info.size === 'number' && info.size > maxBytes) {
    const mb = (info.size / (1024 * 1024)).toFixed(1);
    throw new Error(`Image is ${mb} MB; the limit is ${maxBytes / (1024 * 1024)} MB.`);
  }
  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
  if (!base64) throw new Error('The selected image is empty or unreadable.');
  return base64ToBytes(base64);
}
