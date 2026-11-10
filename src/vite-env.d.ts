/// <reference types="vite/client" />

// Removes Vite's `[key: string]: any` fallback on ImportMetaEnv, so reading
// an env var not declared below (e.g. a typo) is a type error.
interface ViteTypeOptions {
  strictImportMetaEnv: unknown
}

interface ImportMetaEnv {
  // Undefined when missing from .env; src/lib/env.ts checks at startup.
  readonly VITE_SUPABASE_URL: string | undefined
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string | undefined
  // Undefined or empty keeps Sentry off (local dev, CI).
  readonly VITE_SENTRY_DSN: string | undefined
}

// Vercel's VERCEL_ENV (production | preview | development) at build time,
// or null outside Vercel. Replaced by `define` in vite.config.ts.
declare const __VERCEL_ENV__: string | null

interface ImportMeta {
  readonly env: ImportMetaEnv
}
