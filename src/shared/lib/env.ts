// Public runtime config. Only EXPO_PUBLIC_* values are safe in the bundle (W-005).
// Service-role keys live in Edge Functions / CI, never here.
//
// Vars are inlined by Metro at build time from `.env`. Missing/malformed values fail fast at
// module load so a misconfigured app never silently talks to nothing — and so the user sees a
// clear actionable error instead of the Supabase edge's cryptic "Invalid path specified in
// request URL" (which surfaces when, e.g., the URL has a trailing slash).

const rawUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const rawAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

if (!rawUrl || !rawAnonKey) {
  throw new Error(
    'Missing Supabase env vars. Copy .env.example to .env and set ' +
      'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
  );
}

// Shape validation — the URL is the common footgun. Each branch states exactly what to fix.
function validateSupabaseUrl(url: string): string {
  if (!url.startsWith('https://')) {
    throw new Error(
      'EXPO_PUBLIC_SUPABASE_URL must start with "https://". ' +
        'Copy the "Project URL" from Supabase → Settings → API and restart Expo.',
    );
  }
  if (url.endsWith('/')) {
    throw new Error(
      'EXPO_PUBLIC_SUPABASE_URL must not end with a trailing slash ("/"). ' +
        'Remove it from .env and restart Expo. (Trailing slash makes the SDK build paths ' +
        'like "https://…//auth/v1/signup", which the Supabase edge rejects as Invalid path.)',
    );
  }
  // Catch the case where the user pasted "https://<ref>.supabase.co/auth/v1" by accident.
  if (/\/[a-z0-9]/i.test(url.slice('https://'.length))) {
    throw new Error(
      'EXPO_PUBLIC_SUPABASE_URL must not contain a path (only the host). ' +
        'Use exactly "https://<project-ref>.supabase.co" — nothing after .co.',
    );
  }
  return url;
}

export const env = {
  supabaseUrl: validateSupabaseUrl(rawUrl),
  supabaseAnonKey: rawAnonKey,
} as const;
