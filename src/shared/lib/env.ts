// Public runtime config. Only EXPO_PUBLIC_* values are safe in the bundle (W-005).
// Service-role keys live in Edge Functions / CI, never here.
//
// Vars are inlined by Metro at build time from `.env`. Missing values fail fast at module
// load so a misconfigured app never silently talks to nothing.

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env vars. Copy .env.example to .env and set ' +
      'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
  );
}

export const env = {
  supabaseUrl,
  supabaseAnonKey,
} as const;
