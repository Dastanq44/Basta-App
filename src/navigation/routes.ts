// Typed route helpers — a hand-authored, stable map of the app's routes so feature code
// navigates against typed constants rather than scattered string literals. Complements
// expo-router's file-based routes + experimental typedRoutes (app.json).

export const Routes = {
  today: '/',
  challenges: '/challenges',
  groups: '/groups',
  profile: '/profile',
  signIn: '/sign-in',
  challenge: (id: string) => `/challenge/${id}` as const,
  verify: (submissionId: string) => `/verify/${submissionId}` as const,
} as const;

export type StaticRoute = Extract<(typeof Routes)[keyof typeof Routes], string>;
