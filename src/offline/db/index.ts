// Local persistence — engine selected: Expo SQLite (D-007).
// MMKV is deferred per the Expo Go compatibility constraint (it requires a custom dev build).
// If MMKV is added later, route hot KV (flags, cursors) through a tiny `kv` adapter so callers
// don't need to change.
export { getDb } from './init';
export { DB_NAME, SCHEMA_VERSION } from './schema';
