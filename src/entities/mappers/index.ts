// DTO → domain mappers live here (DECISIONS.md D-002). The UI/feature layers consume
// domain entities only — never raw Supabase row types. Mappers are added per feature
// alongside its API layer (e.g. toSubmission(row), toChallenge(row)).
export {};
