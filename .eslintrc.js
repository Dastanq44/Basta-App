// ESLint config — enforces the layered architecture from DECISIONS.md D-002.
// Boundaries use core `no-restricted-imports` (alias-based) so no extra resolver is required.
//
// Layering contract:
//   app/      -> features, shared            (NOT offline/services/entities directly)
//   features/ -> entities, shared, offline, services
//   entities/ -> nothing app-specific        (pure domain)
//   shared/   -> nothing app-specific        (lowest layer)
//   No feature may import another feature's INTERNALS — only its public index (`@/features/<name>`).

/** Deep alias import into any feature's internals (everything except the feature's index). */
const NO_FEATURE_INTERNALS = {
  group: ['@/features/*/*'],
  message: 'Import a feature only through its public surface: `@/features/<name>` (its index.ts).',
};

module.exports = {
  root: true,
  extends: ['expo'],
  // supabase/functions/ ships Deno-native code (npm: specifiers, Deno.serve) that the
  // Node/Expo lint pipeline can't resolve. Linted via `deno lint` in CI when needed.
  ignorePatterns: ['node_modules/', '.expo/', 'dist/', 'babel.config.js', 'supabase/functions/'],
  rules: {
    'no-restricted-imports': ['error', { patterns: [NO_FEATURE_INTERNALS] }],
  },
  overrides: [
    {
      files: ['src/entities/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': ['error', { patterns: [
          { group: ['@/features/*', '@/app/*', '@/services/*', '@/offline/*'],
            message: 'entities/ is pure domain — it must not depend on app-specific layers.' },
        ]}],
      },
    },
    {
      files: ['src/shared/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': ['error', { patterns: [
          { group: ['@/features/*', '@/app/*', '@/services/*', '@/offline/*', '@/entities/*'],
            message: 'shared/ is the lowest layer — it must not import higher layers.' },
        ]}],
      },
    },
    {
      files: ['app/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': ['error', { patterns: [
          NO_FEATURE_INTERNALS,
          { group: ['@/offline/*'],
            message: 'Screens stay thin — reach offline/ through a feature hook, not directly.' },
        ]}],
      },
    },
  ],
};
