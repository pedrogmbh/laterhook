# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

laterhook: a self-hosted webhook inbox. Any request to `/webhooks/<slug>[/<deeper>]` is stored instantly (endpoint auto-created); a password-gated dashboard lets you browse, search, tag, annotate, forward and replay requests. Deployed on Vercel; data in Cloudflare D1 (via REST API) in production and local SQLite in dev. See README.md for setup.

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

**Auth.** `src/lib/auth.ts` signs a `<exp>.<hmac>` token with Web Crypto only, so the same code runs in `proxy.ts` and in server components/actions. Password and secret come from env; the secret falls back to a password-derived value.

**Mutations.** All writes from the UI go through server actions in `src/app/actions.ts`; each one calls `guard()` (auth check) first and `revalidatePath("/", "layout")` after. Forwarding and replay share `deliver()` in `src/lib/forward.ts`, which strips hop-by-hop/platform headers, re-appends the stored sub-path and query to the target, records a row in `deliveries`, and (for auto-forwards) writes `forward_status`/`forward_error` back onto the request.

**UI.** Route group `src/app/(app)/` wraps pages in `AppShell` (sidebar with endpoint list, live poller, base URL). Pages are server components; small client islands handle interaction (`request-actions`, `tags-editor`, `note-editor`, `filters-bar`, `endpoint-settings-form`, `live-poller`). `LivePoller` polls `/api/requests/latest?since=` every 3s and calls `router.refresh()` when new rows exist. Filters are URL search params, read by the page and by `FiltersBar` (wrap it in `Suspense` since it uses `useSearchParams`). Pagination is a `before=<received_at>` cursor.

**Colour system.** Endpoint colours and HTTP methods are hues. Set `--h` on an element (via `hueStyle(color)` or `METHOD_HUE`) and use the `hue-chip`, `hue-dot`, `hue-text`, `hue-bar`, `hue-accent-border` classes from `globals.css`; they have light and dark variants and live in `@layer components` so Tailwind utilities can override sides. JSON highlighting is server-rendered by `highlightJson` in `src/components/json-view.tsx` with `tok-*` classes.

## Stack notes

- **Next.js 16.3.5, App Router, `src/app/`.** `params`/`searchParams` are Promises; use the global `PageProps<'/route'>`, `LayoutProps`, `RouteContext` helpers (generated by `next typegen`/`next dev`). Docs in `node_modules/next/dist/docs/` are the source of truth.
- **Path alias:** `@/*` maps to `./src/*`.
- **Tailwind CSS v4, CSS-first.** No `tailwind.config.*`; all tokens in `src/app/globals.css` (`@theme inline`, oklch variables, class-based dark mode via `next-themes`).
- **shadcn v4** (`components.json`): style `base-sera` (sharp corners, uppercase tracking labels), base colour `mist`, built on **`@base-ui/react`** (not Radix), icons from **Hugeicons** (`HugeiconsIcon` + `@hugeicons/core-free-icons`). When rendering a `Button`/`TabsTrigger` as a `Link` via `render=`, pass `nativeButton={false}`.
- **`cn`** comes from the `cn` package re-exported at `@/lib/utils`.
- **Fonts:** `font-sans` IBM Plex Sans, `font-heading` Space Grotesk, `font-mono` Geist Mono, wired in `src/app/layout.tsx`.
- Timestamps that render locale/timezone-specific text must be client components (`TimeAgo`, `LocalTime`) to avoid hydration mismatches.
