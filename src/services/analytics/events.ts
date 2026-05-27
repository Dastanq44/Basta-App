// Typed analytics events — no stringly-typed tracking. Add events as features land.

export type AnalyticsEvent =
  | { name: 'app_opened'; props: Record<string, never> }
  | { name: 'proof_submitted'; props: { challengeId: string; hasMedia: boolean } }
  | { name: 'challenge_created'; props: { mode: 'solo' | 'group'; durationDays: number } }
  | { name: 'verification_completed'; props: { result: 'approve' | 'reject' } }
  | { name: 'streak_milestone'; props: { days: number } };

export type AnalyticsEventName = AnalyticsEvent['name'];
export type PropsFor<N extends AnalyticsEventName> = Extract<AnalyticsEvent, { name: N }>['props'];
