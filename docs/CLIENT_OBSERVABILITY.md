# Client Observability

Giverny uses a first-party browser observability pipeline instead of sending task or user content to a third-party replay SDK.

## Data Flow

1. `AppErrorBoundary` reports React render failures.
2. `clientErrorReporter` captures global script errors, unhandled promises, failed script/style resources, dynamic chunk failures, and handled API network/5xx failures.
3. `clientPerformanceReporter` uses native `PerformanceObserver` entries to collect TTFB, FCP, LCP, INP, CLS, and page load duration.
4. The Worker validates same-origin requests, limits request size, removes URLs, emails and likely secrets, and assigns the active workspace/principal context.
5. D1 stores aggregated error fingerprints for 90 days and one updatable performance row per page load for 30 days.
6. Settings -> Models -> Runtime and Quality Center shows error versions/routes/stacks, P75 experience metrics and slow routes.

## Experience Ratings

- Good: LCP <= 2.5s, INP <= 200ms, CLS <= 0.1.
- Needs improvement: at least one metric exceeds the good boundary.
- Poor: LCP > 4s, INP > 500ms, or CLS > 0.25.
- Operational summaries use P75 rather than averages so a small number of unusually fast visits cannot hide a broadly slow experience.

INP uses the longest observed interaction duration for the current page session. A page with no interaction keeps INP at zero and is not treated as slow because of missing interaction data.

## Alerts

The existing operations alert workflow also covers the frontend:

- Five or more recent frontend error occurrences create an error-volume alert; 20 or more is critical.
- At least three samples with poor P75 Core Web Vitals create a critical performance alert.
- At least five samples with a 25% poor-session rate create a warning.

Acknowledgement and resolution use the same administrator-only workflow as model and background-job alerts.

## Privacy And Retention

- Never send form values, task requirements, chat content, attachment content, query strings, hashes, or full external resource URLs.
- Error payloads are capped at 16KB; performance payloads are capped at 8KB.
- Error messages and stacks remove URLs, email addresses and likely API secrets before storage.
- Performance rows contain only route pathname, release version, coarse device/network class and numeric timings.
- Data is isolated by `workspace_id`; the runtime center remains administrator-only.
- Error aggregates expire after 90 days; performance sessions expire after 30 days.

## Cloudflare Layer

Worker observability remains enabled with 10% request-head sampling, so server-side structured errors can be searched in Cloudflare Workers Logs. Browser RUM stays first-party in D1 and therefore does not require a public analytics token or a session-replay vendor.

## Release Checks

- `npm run architecture:guard` verifies browser capture, Worker endpoints, retention, D1 schema, alerts, management UI and Cloudflare logging configuration.
- `npm run db:apply:production -- db/migrations/<file>.sql` applies reviewed, idempotent D1 SQL through the Cloudflare HTTP API without Wrangler.
- Production smoke tests should use a temporary telemetry session ID and delete it after the endpoint response is verified.
