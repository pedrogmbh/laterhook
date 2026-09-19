# laterhook

**Catch every webhook now. Sort it out later.**

laterhook is a self-hosted webhook inbox. Point any provider at
`https://your-deployment/webhooks/<any-name>` and the request is stored
immediately, with zero configuration. Later, from a password-protected dashboard,
you can browse and search everything that arrived, name and colour endpoints,
tag and annotate requests, forward new traffic to its real destination, and
replay any stored request to any URL.

## How it works

| Piece | Where |
| --- | --- |
| Ingest API, any method, any depth | `/webhooks/<endpoint>[/<deeper/path>]` |
| Dashboard | `/` (overview), `/inbox`, `/e/<endpoint>`, `/r/<request id>` |
| Auth | single password from `LATERHOOK_PASSWORD`, signed cookie session |
| Storage | Cloudflare D1 via its REST API in production, local SQLite in development |
| Hosting | Vercel (Next.js App Router, Node.js runtime) |

The first path segment after `/webhooks/` becomes the endpoint. It is created on
first contact. Everything after it is kept as a sub-path, and is re-appended
when forwarding or replaying, so `/webhooks/shop/stripe/live` forwards to
`<target>/stripe/live`.

Each stored request keeps: method, full URL, all headers, query string, body
(text or base64 for binary, truncated above `LATERHOOK_MAX_BODY_BYTES`), source
IP, user agent, and timestamp. You can star it, tag it, write a note, copy it as
a `curl` command, and see every delivery attempt with status, latency, and the
response body.

## Local development

```bash
bun install
cp .env.example .env.local   # set LATERHOOK_PASSWORD; leave DATABASE_DRIVER=sqlite
bun dev
```

Open http://localhost:3000, log in, then send something:

```bash
curl -X POST http://localhost:3000/webhooks/my-product/stripe \
  -H 'content-type: application/json' \
  -d '{"event":"payment.succeeded","amount":4200}'
```

The local database lives at `.data/laterhook.db` (git-ignored) and is created
on the first request.

## Deploying to Vercel with Cloudflare D1

1. Create the database: `wrangler d1 create laterhook` (or use the Cloudflare
   dashboard). Note the database id.
2. Create a Cloudflare API token with the **D1: Edit** permission for your
   account. Note your account id.
3. In Vercel, set these environment variables:

   | Variable | Value |
   | --- | --- |
   | `LATERHOOK_PASSWORD` | your dashboard password |
   | `LATERHOOK_SECRET` | a long random string (signs the session cookie) |
   | `LATERHOOK_D1_ACCOUNT_ID` | from step 2 |
   | `LATERHOOK_D1_DATABASE_ID` | from step 1 |
   | `LATERHOOK_D1_TOKEN` | from step 2 |
   | `IP_API_KEY` | optional, ip-api.com Pro key for sender geolocation |

   The generic `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID` and
   `CLOUDFLARE_API_TOKEN` names also work, but the `LATERHOOK_D1_*` ones take
   precedence, which matters if your shell exports a global Cloudflare token.

4. Deploy. The schema is created automatically on the first request. To
   verify credentials beforehand, run `bun run db:migrate` locally with the
   same variables in `.env.local`.

`DATABASE_DRIVER` can be set explicitly to `d1` or `sqlite`; when unset it is
`d1` if the three D1 variables are present and `sqlite` otherwise.

## Sender geolocation (optional)

Set `IP_API_KEY` to an [ip-api.com](https://ip-api.com) Pro license key and
every sender IP is looked up once and cached in the `ip_info` table (refreshed
after `IP_API_CACHE_DAYS`, default 30). You then get:

- an **Origin** card on each request: flag, city, region, country, ISP,
  organisation, AS, timezone, reverse DNS, coordinates, and proxy/VPN,
  datacenter and mobile flags;
- a flag and place next to each row in the inbox and endpoint lists;
- an **Origins, last 24h** breakdown by country on the overview;
- IP search in the inbox search box.

Private and reserved addresses are recognised locally and never sent to the
API. Without a key nothing is looked up and the UI just shows the raw IP.

## Configuration

See [`.env.example`](./.env.example) for every variable, including body size
limit, forward timeout, session lifetime, and `LATERHOOK_PUBLIC_URL` for the
URLs shown in the UI.

## Endpoint settings

Each endpoint has a settings tab with:

- **Identity**: display name, description, colour.
- **Forwarding**: a target URL and a switch. When on, every new request is
  re-sent right after it is stored (using `after()`, so the sender is
  acknowledged first). The original headers are preserved except hop-by-hop and
  platform headers, and `x-laterhook-*` headers are added.
- **Response**: the status code, content type, and body returned to the sender.
  Some providers require a specific acknowledgement.
- **Danger zone**: clear requests, archive, delete.

## Scripts

```bash
bun dev             # dev server
bun run build       # production build
bun start           # serve the production build
bun run typecheck   # tsc --noEmit
bun run db:migrate  # apply schema to D1 (reads .env.local / .env)
```
