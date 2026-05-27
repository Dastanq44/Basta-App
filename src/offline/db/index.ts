// Local persistence — engine-agnostic contract (skeleton).
//
// Engine chosen (D-007): Expo SQLite (relational) + MMKV (key/value). WatermelonDB deferred.
// This interface keeps feature/data layers decoupled from the engine so it can be swapped
// without touching callers. Implementation lands in Phase 2 (the offline critical path).
// See docs/architecture/OFFLINE_SYNC.md and DECISIONS.md D-007.

export interface LocalDatabase {
  init(): Promise<void>;
  /** Key/value access (drafts metadata, cursors, flags). */
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
}

/** Not implemented until Phase 2 (engine = Expo SQLite + MMKV, D-007); throws so misuse is loud. */
const NOT_IMPLEMENTED = 'Local DB not implemented yet — Expo SQLite + MMKV, lands in Phase 2 (D-007).';
export const localDatabase: LocalDatabase = {
  async init() {
    throw new Error(NOT_IMPLEMENTED);
  },
  async get() {
    throw new Error(NOT_IMPLEMENTED);
  },
  async set() {
    throw new Error(NOT_IMPLEMENTED);
  },
  async delete() {
    throw new Error(NOT_IMPLEMENTED);
  },
};
