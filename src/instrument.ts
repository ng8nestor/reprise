import * as Sentry from '@sentry/react'
import { readSentryConfig } from './lib/sentryConfig.ts'
import { scrubBreadcrumb, scrubEvent } from './lib/sentryScrub.ts'

// Imported first in main.tsx. An ES module runs once, so this is the one
// place Sentry starts, and it starts before the rest of the app loads, which
// lets it see a crash during startup too.
//
// With no VITE_SENTRY_DSN (local dev, CI) config is null and nothing below
// runs: no network calls, no console output.
const config = readSentryConfig({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  vercelEnv: __VERCEL_ENV__,
})

if (config) {
  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,

    // SDK v11 removed `sendDefaultPii`; `dataCollection` replaces it, and its
    // defaults collect MORE (cookies, headers, bodies, query strings), so
    // every category is switched off here. This is the "sendDefaultPii:
    // false" of older versions, spelled out. The user id is still attached
    // by hand (sentryUser.ts).
    dataCollection: {
      userInfo: false,
      cookies: false,
      // The browser and OS are worked out from the User-Agent; no other header.
      httpHeaders: { request: { allow: ['User-Agent'] }, response: false },
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      stackFrameVariables: false,
    },

    // Performance tracing is deliberately off: neither tracesSampleRate nor
    // browserTracingIntegration is set. For one user, error tracking is the
    // value; tracing would add bundle weight, a sentry-trace header on every
    // /api/extract call, and span URLs to scrub. To try it later, add
    // browserTracingIntegration and tracesSampleRate: 0.1, and add a
    // beforeSendTransaction that strips URL query strings.
    //
    // Session Replay is off the same way: no replayIntegration, because a
    // replay is a recording of the screen, which is highlight text and photos.

    integrations: (defaults) => [
      // Console logs and click targets can carry what is on screen, so neither
      // becomes a breadcrumb. Fetch, XHR and navigation breadcrumbs stay (with
      // query strings stripped by scrubBreadcrumb).
      ...defaults.filter(
        (integration) =>
          integration.name !== 'Console' && integration.name !== 'Breadcrumbs',
      ),
      Sentry.breadcrumbsIntegration({ dom: false }),
    ],

    beforeBreadcrumb: scrubBreadcrumb,
    beforeSend: scrubEvent,
  })
}
