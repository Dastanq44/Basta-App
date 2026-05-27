// Deep-link configuration. Tokens NEVER travel in URLs (W-005) — links carry only ids,
// the one-time token goes in the request body. Refined when verify/auth deep-links land.

export const linkingPrefixes = ['basta://', 'https://basta.app'] as const;
