// Local persistence — engine-agnostic contract (skeleton).
//
// ⚠️ The concrete engine is DECISION D-007 (PENDING): WatermelonDB vs SQLite + MMKV.
// This interface lets feature/data layers be written against an abstraction so the
// engine can be chosen/swapped without touching callers. Do NOT import a specific
// engine here until D-007 is settled. See docs/architecture/OFFLINE_SYNC.md.

export interface LocalDatabase {
  init(): Promise<void>;
  /** Key/value access (drafts metadata, cursors, flags). */
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
}

/** Placeholder until D-007 is decided; throws if used so misuse is loud, not silent. */
export const localDatabase: LocalDatabase = {
  async init() {
    throw new Error('Local DB engine not selected yet (DECISIONS.md D-007).');
  },
  async get() {
    throw new Error('Local DB engine not selected yet (DECISIONS.md D-007).');
  },
  async set() {
    throw new Error('Local DB engine not selected yet (DECISIONS.md D-007).');
  },
  async delete() {
    throw new Error('Local DB engine not selected yet (DECISIONS.md D-007).');
  },
};
