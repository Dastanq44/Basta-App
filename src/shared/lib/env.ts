// Public runtime config. Only EXPO_PUBLIC_* values are safe in the bundle (W-005).
// Service-role keys live in Edge Functions / CI, never here.

export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
} as const;
