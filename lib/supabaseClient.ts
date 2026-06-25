// ─────────────────────────────────────────────────────────────────────────────
// Supabase client (stub).
//
// The app runs entirely on the mock RAG layer by default, so no Supabase
// connection is required to develop or demo. This module exposes the env-driven
// configuration and a lazy client factory so the data layer can be promoted to
// a real pgvector-backed store without rewriting call sites.
//
// To go live:
//   1. `npm i @supabase/supabase-js`
//   2. Fill NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
//   3. Uncomment the createClient import + implementation below.
// ─────────────────────────────────────────────────────────────────────────────

export const supabaseConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
};

export const isSupabaseConfigured = (): boolean =>
  Boolean(supabaseConfig.url && supabaseConfig.anonKey);

// import { createClient } from "@supabase/supabase-js";
//
// export const supabase = isSupabaseConfigured()
//   ? createClient(supabaseConfig.url, supabaseConfig.anonKey)
//   : null;

export const supabase = null;
