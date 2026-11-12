import { sentryVitePlugin } from '@sentry/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { bundleCheckPlugin } from './vite.bundle-check.ts'
import {
  readSentryBuildSettings,
  sentryDebugIdQuotesPlugin,
} from './vite.sentry.ts'

const sentry = readSentryBuildSettings(process.env)
if (!sentry.uploadSourceMaps && sentry.warning) console.warn(sentry.warning)

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Fails the build if a served file carries a secret, the commit message,
    // or any non-public environment value. Before the Sentry upload, so a
    // leaking build uploads nothing either.
    bundleCheckPlugin(process.env),
    // Keeps the uploaded source maps lined up with the served files; see
    // vite.sentry.ts for the full story.
    sentry.uploadSourceMaps && sentryDebugIdQuotesPlugin(),
    // Last, so it sees the finished bundle. Present only when a build has
    // everything it needs to upload; every other build has no source maps.
    sentry.uploadSourceMaps &&
      sentryVitePlugin({
        authToken: sentry.authToken,
        org: sentry.org,
        project: sentry.project,
        release: { name: sentry.release, setCommits: false },
        sourcemaps: {
          // Maps are written, uploaded, then removed: they never reach dist/,
          // so Vercel never serves them.
          deleteSourcemapsAfterUpload: true,
          filesToDeleteAfterUpload: ['./dist/**/*.map'],
        },
        // An upload problem is a warning in the build log, not a failed
        // deploy. The cost is minified stack traces until it is fixed.
        errorHandler: (error) => console.warn(`[sentry] ${error.message}`),
        // The plugin sends anonymous usage data to Sentry by default.
        telemetry: false,
      }),
  ],
  define: {
    // The client can't read VERCEL_ENV directly (Vite only exposes VITE_*),
    // so the build bakes it in. src/lib/sentryConfig.ts maps it.
    __VERCEL_ENV__: JSON.stringify(process.env.VERCEL_ENV ?? null),
  },
  build: {
    // 'hidden' writes maps without a sourceMappingURL comment in the bundle.
    // Off entirely unless a Sentry upload will consume and delete them.
    sourcemap: sentry.uploadSourceMaps ? 'hidden' : false,
  },
})
