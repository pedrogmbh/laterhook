<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# laterhook: guide for coding agents

laterhook is a self-hosted webhook inbox. Any request to `/webhooks/<slug>[/<deeper>]` is stored instantly (endpoint auto-created); a password-gated dashboard lets you browse, search, tag, annotate, forward and replay requests, and register regex **routes** that forward, protect (header secret), shape the response and tag traffic permanently. Deployed on Vercel; data in Cloudflare D1 (via REST API) in production and local SQLite in dev. README.md has the product tour and screenshots live in `docs/screenshots/` (Screely captures; reuse them in docs rather than re-shooting).

## Commands

Package manager is **Bun** (`packageManager: bun@1.4.2`, `bun.lock`). Do not use npm/yarn/pnpm.

```bash
bun install            # install deps
bun dev                # dev server on http://localhost:3000 (only one `next dev` can run per project; a second one exits)
bun run build          # production build
bun start              # serve the production build
bun run typecheck      # tsc --noEmit (run `bunx next typegen` first on a fresh clone so PageProps/RouteContext exist)
bun run db:migrate     # apply schema to D1 using .env.local/.env credentials
bunx shadcn add <name> # add a shadcn component into src/components/ui
```

There is no test runner, ESLint, or Prettier config. `bun run build` plus `tsc` are the checks. Local dev needs `.env.local` with at least `LATERHOOK_PASSWORD` (see `.env.example`); with no Cloudflare vars the SQLite driver is used and writes `.data/laterhook.db`.

## Architecture

**Request flow.** `src/proxy.ts` (Next 16's replacement for middleware) gates everything except `/webhooks/*`, static assets and `/login` behind the session cookie. `src/app/webhooks/[[...path]]/route.ts` is the public catch-all: it exports every HTTP method bound to one `capture` function, validates the slug, reads the body (utf8 or base64, capped by `LATERHOOK_MAX_BODY_BYTES`), calls `ensureEndpoint` + `insertRequest`, and if the endpoint has forwarding on, schedules `deliver()` inside `after()` so the sender is acknowledged first. CORS preflights are answered without being stored.

**Data layer.** `src/lib/db/` exposes a tiny `Database` interface (`query`, `batch`) with two drivers: `d1.ts` (Cloudflare D1 HTTPS REST API, one round trip per statement) and `sqlite.ts` (`node:sqlite`, dev only). `index.ts` picks the driver from `env.databaseDriver`, caches the connection on `globalThis` keyed by a fingerprint of `schema.ts`, and applies the schema idempotently on first use (and again whenever the schema changes), so there is no migration step. Add new tables/indexes as `IF NOT EXISTS` statements. All SQL lives in `src/lib/repo.ts`; nothing else should write SQL. Columns are snake_case and rows are mapped to the camel-free types in `src/lib/types.ts` (booleans stored as 0/1, JSON as text).

**Env.** Every environment variable is read through `src/lib/env.ts` getters. Never read `process.env` elsewhere. D1 credentials accept `LATERHOOK_D1_*` (preferred) or `CLOUDFLARE_*`; the specific names win because the user's shell exports a global `CLOUDFLARE_API_TOKEN` for another account, which would otherwise shadow `.env.local`.

**IP enrichment.** `src/lib/ipinfo.ts` wraps ip-api.com Pro (enabled only when `IP_API_KEY` is set). Lookups are cached per IP in `ip_info`; reserved ranges are detected locally. The capture route enqueues a lookup in `after()`, the request page calls `lookupIp` inline (cache hit after the first time), list pages use `getCachedIpInfoMany` (read-only), and the overview uses `topOrigins`. The `fields` bitmask in the API URL must stay `66846719`.

**AI triage.** `src/lib/triage.ts` asks TypeSafe's Jev (a "System One" model that returns typed Choice/Score/boolean answers with probabilities, not text) through Vercel AI Gateway using the AI SDK's `experimental_evaluate` with `createGateway({ apiKey: env.aiGatewayApiKey }).evaluationModel(env.typesafeAiModel)`. Enabled only when `AI_GATEWAY_API_KEY` is set **and** `TYPESAFE_AI_ENABLED` is truthy (`triageEnabled()`). One call per request asks five independent questions over one state (redacted headers, body capped at 16k chars, cached ip-api network facts): `source` and `kind` (Choice), `attention` (Score 0–2), `failure` and `sensitive` (boolean). Results go to the `request_insights` table (one row per request, raw probabilities and TypeSafe confidence kept as JSON, failed attempts stored as `status='error'`). The event name comes from `extractEventName` (headers/body keys) in code. The capture route runs the IP lookup then triage in one `after()`; the request page calls `ensureTriage` inline (first view, or retry of an error older than 5 min); lists read `getInsightsMany`; the overview uses `getTriageSummary` and a backlog action (`triageMany`, concurrency 3, stops on the Gateway rate limit). The vocabulary (source/kind keys, attention levels, thresholds such as `NEEDS_ACTION_MIN`) lives in the browser-safe `src/lib/triage-meta.ts`. Keys are persisted, so add new ones rather than renaming. Inbox filters: `action=1`, `hidenoise=1`, `source=<key>`. Free-tier Gateway credits are rate-limited on this model; that surfaces as a friendly "rate-limited" state, not a crash.

**Auth.** `src/lib/auth.ts` signs a `<exp>.<hmac>` token with Web Crypto only, so the same code runs in `proxy.ts` and in server components/actions. Password and secret come from env; the secret falls back to a password-derived value.

**Routes.** `routes` table + `route_id`/`rejected`/`rejected_reason` columns on `requests` (added via `SCHEMA_MIGRATIONS`, which run one by one ignoring "duplicate column"). Pure regex helpers live in `src/lib/route-match.ts` (browser-safe, used by the client form for live validation); `src/lib/routes.ts` re-exports them and adds the DB read. Never import `repo`/`db` from a client component: it drags `node:fs` into the browser bundle and Turbopack fails the build. Matching happens in the capture route: `matchRoute` (first enabled by priority, method filter), `checkSecret` (timing-safe header compare; failures are stored with `rejected=1`, answered 401, not forwarded), then route forwarding (`expandTarget` fills `$1`/`$<name>`, `appendPath: false`, extra headers) which wins over endpoint forwarding, then route response overrides endpoint response. `getEnabledRoutes` is intentionally uncached so a saved route applies to the very next request. `/routes/new?from=<requestId>` and `?endpoint=<slug>` pre-fill drafts via `escapeToPattern` / `endpointPattern`; creating a route backfills `route_id` on matching unrouted requests.

**Mutations.** All writes from the UI go through server actions in `src/app/actions.ts`; each one calls `guard()` (auth check) first and `revalidatePath("/", "layout")` after. Forwarding and replay share `deliver()` in `src/lib/forward.ts`, which strips hop-by-hop/platform headers, re-appends the stored sub-path and query to the target, records a row in `deliveries`, and (for auto-forwards) writes `forward_status`/`forward_error` back onto the request.

**UI.** Route group `src/app/(app)/` wraps pages in `AppShell` (sidebar with endpoint list, live poller, base URL). Pages are server components; small client islands handle interaction (`request-actions`, `tags-editor`, `note-editor`, `filters-bar`, `endpoint-settings-form`, `live-poller`, `triage-buttons`). `LivePoller` polls `/api/requests/latest?since=` every 3s and calls `router.refresh()` when new rows exist. Filters are URL search params, read by the page and by `FiltersBar` (wrap it in `Suspense` since it uses `useSearchParams`). Pagination is a `before=<received_at>` cursor.

**Metadata & sharing.** Brand copy/colours live in `src/lib/brand.ts` (hex twins of the oklch tokens, for SVG/Satori). Icons and social images are Next metadata file conventions in `src/app/`: `icon.svg`, `apple-icon.tsx`, `opengraph-image.tsx` (Satori via `next/og`, fonts read from `src/assets/fonts/*.ttf` at module scope), `twitter-image.tsx` (re-export), `manifest.ts`, `robots.ts` (disallow all; the app also sets `robots: noindex`). `metadataBase` comes from `env.metadataBase` (`LATERHOOK_PUBLIC_URL`, else Vercel's production URL). These routes are excluded from the auth matcher in `src/proxy.ts` so link-preview crawlers can fetch them; keep that list in sync if you add more metadata files.

**Colour system.** Endpoint colours and HTTP methods are hues. Set `--h` on an element (via `hueStyle(color)` or `METHOD_HUE`) and use the `hue-chip`, `hue-dot`, `hue-text`, `hue-bar`, `hue-accent-border` classes from `globals.css`; they have light and dark variants and live in `@layer components` so Tailwind utilities can override sides. JSON highlighting is server-rendered by `highlightJson` in `src/components/json-view.tsx` with `tok-*` classes.

## Stack notes

- **Next.js 16.3.5, App Router, `src/app/`.** `params`/`searchParams` are Promises; use the global `PageProps<'/route'>`, `LayoutProps`, `RouteContext` helpers (generated by `next typegen`/`next dev`). Docs in `node_modules/next/dist/docs/` are the source of truth.
- **Path alias:** `@/*` maps to `./src/*`.
- **Tailwind CSS v4, CSS-first.** No `tailwind.config.*`; all tokens in `src/app/globals.css` (`@theme inline`, oklch variables, class-based dark mode via `next-themes`).
- **shadcn v4** (`components.json`): style `base-sera` (sharp corners, uppercase tracking labels), base colour `mist`, built on **`@base-ui/react`** (not Radix), icons from **Hugeicons** (`HugeiconsIcon` + `@hugeicons/core-free-icons`). When rendering a `Button`/`TabsTrigger` as a `Link` via `render=`, pass `nativeButton={false}`.
- **`cn`** comes from the `cn` package re-exported at `@/lib/utils`.
- **Fonts:** `font-sans` IBM Plex Sans, `font-heading` Space Grotesk, `font-mono` Geist Mono, wired in `src/app/layout.tsx`.
- Timestamps that render locale/timezone-specific text must be client components (`TimeAgo`, `LocalTime`) to avoid hydration mismatches.

## Working conventions

- Keep the capture path zero-setup: nothing may require configuration before a webhook can be stored.
- Every schema change is an idempotent `CREATE ... IF NOT EXISTS` in `SCHEMA_STATEMENTS` or an `ALTER TABLE ... ADD COLUMN` in `SCHEMA_MIGRATIONS`; there is no migration tool.
- Verify UI changes in a real browser (Playwright with the bundled Chromium works headless; log in with the password from `.env.local`). Send test webhooks with `curl` and add `x-forwarded-for` to simulate a public sender IP.
- The user's dev server usually already runs on port 3000 and hot-reloads; a second `next dev` in the same project exits. Test against it instead of starting another.
- Don't commit or push unless asked. The working database in `.env.local` may be the real D1 database; clean up test endpoints and routes you create.
