// Crash/error reporting interface. Concrete adapter (e.g. Sentry) wired in a later phase.

export interface CrashReporter {
  init(): void;
  captureException(error: unknown, context?: Record<string, unknown>): void;
  setUser(userId: string | null): void;
}

/** No-op default so the app runs before the reporter is configured. */
export const crash: CrashReporter = {
  init: () => {},
  captureException: () => {},
  setUser: () => {},
};
