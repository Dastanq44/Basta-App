// Public surface of the offline subsystem (so layouts/screens can call `initOffline()` once
// without violating the import-boundary rule that forbids deep `@/offline/*` imports from app/).
import { getDb } from './db';
import { startProcessor } from './queue';

/**
 * Opens the local SQLite DB and starts the queue processor.
 * Returns a teardown that stops the processor and removes its listeners.
 */
export async function initOffline(): Promise<() => void> {
  await getDb();
  return startProcessor();
}
