import type { AnalyticsEventName, PropsFor } from './events';

export type { AnalyticsEvent, AnalyticsEventName, PropsFor } from './events';

export interface Analytics {
  track<N extends AnalyticsEventName>(name: N, props: PropsFor<N>): void;
  identify(userId: string): void;
  reset(): void;
}

/**
 * No-op default. A concrete adapter (PostHog/Amplitude) is wired in a later phase,
 * with PII scrubbing at this boundary. Features depend on the `Analytics` interface,
 * never a vendor SDK directly.
 */
export const analytics: Analytics = {
  track: () => {},
  identify: () => {},
  reset: () => {},
};
