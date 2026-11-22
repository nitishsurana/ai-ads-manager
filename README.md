# AI Ads Manager

Paste a Shopify product URL and get rounds of 9:16 ad creatives. The app reads the product page (price, rating, photos, brand kit), lets you confirm what it found, then generates, checks and judges creatives you can rate and iterate on.

Built with Next.js 16, React 19, Supabase (Postgres, auth, storage), Vercel Workflows, the Vercel AI Gateway, Fal and Firecrawl.

Everything past the sign-in page needs a real Supabase project with the migrations applied, even in replay mode. Without one, the app starts and shows the sign-in page, and the offline test suites pass.

## Prerequisites

- Node.js 24 and npm. The Supabase CLI is not needed separately: `npm run db:push` runs it through `npx`.
- A [Supabase](https://supabase.com) project (the free plan is enough)
- API keys for:
  - [Vercel AI Gateway](https://vercel.com/docs/ai-gateway): the language and vision models. Create a key in the Vercel dashboard under AI Gateway > API Keys.
  - [Fal](https://fal.ai): cut-outs and generated backgrounds. Create a key in the Fal dashboard under Keys.
  - [Firecrawl](https://firecrawl.dev): page rendering. Copy the key from the Firecrawl dashboard under API Keys.

## Set up

1. Install dependencies.

   ```bash
   npm install
   ```

   npm's audit and `allowScripts` warnings at the end are expected and don't block anything.

2. Create your env file and fill it in. Every key in `.env.example` is required unless it shows a default.

   ```bash
   cp .env.example .env.local
   ```

   - Supabase keys: Project Settings > API keys. `NEXT_PUBLIC_SUPABASE_URL` must be a full URL, `https://<project-ref>.supabase.co`; anything else makes every page return a 500, with the reason only in the server log.
   - `SUPABASE_DB_URL` is the Session pooler connection string (Project Settings > Database), shaped like `postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`.
   - `SESSION_SECRET` and `CRON_SECRET`: random strings. `npm run secrets` prints a fresh pair as `KEY=value` lines; replace the two empty lines in `.env.local` with them.
   - `TESTER_PASSWORD` is what testers type to sign in; `ADMIN_PASSWORD` opens `/admin`.
   - `SPEND_CAP_USD_DAILY` caps model and image spend per UTC day (default 5). It counts every tester on the same Supabase project, a deployed copy included, so a project shared with production may already be at the cap. Once it is reached, Generate is refused until midnight UTC.
   - `CRON_SECRET` is the last key in the file and easy to miss; it is required too.

3. Turn on anonymous sign-ins in Supabase: Authentication > Sign In / Providers > Allow anonymous sign-ins. Testers sign in with a name and the shared password, backed by an anonymous Supabase user.

4. Create the tables, functions and storage buckets.

   ```bash
   npm run db:push
   ```

   This runs `supabase db push` against `SUPABASE_DB_URL` with the migrations in `supabase/migrations`. After changing the schema, regenerate the types with `npm run db:types`.

## Run

```bash
npm run dev
```

Open http://localhost:3000. It redirects to `/sign-in`; sign in with any name and `TESTER_PASSWORD`, then paste a product URL. The admin console is at `/admin` (sign in with `ADMIN_PASSWORD`). If port 3000 is taken, run `npm run dev -- --port 3300` instead.

To work without spending on providers, run in replay mode. Pages, models and images then come from recorded snapshots, so only product URLs with a fixture in `golden/fixtures/*/case.json` can be read. Supabase must still be real, but the provider keys can be any non-empty placeholder. Replay mode is refused in production builds.

```bash
PROVIDERS=fake npm run dev
```

## Test

| Command                | What it runs                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------- |
| `npm run typecheck`    | Route types and TypeScript                                                         |
| `npm run lint`         | ESLint                                                                             |
| `npm run format:check` | Prettier                                                                           |
| `npm run test:golden`  | Step 1 (reading a product page) against committed fixtures                         |
| `npm run test:rounds`  | Round planning, layout, logo, badge and check rules against committed fixtures     |
| `npm run test:e2e`     | Playwright end-to-end tests; they start their own dev server with `PROVIDERS=fake` |

- The golden suites replay recorded provider answers and make no live calls. Rows recorded from real stores live in `.golden/`, which is not committed, so a fresh clone prints `SKIP` lines for them and runs the committed fixtures only. Error stack traces in the output come from cases that test failures on purpose.
- The e2e tests use the Supabase project in `.env.local`. They default to port 3000; set `E2E_PORT` to run beside a dev server you already have open.
- `npm run golden:record` and `npm run golden:round-live` record new rows with live providers and spend real money.

## Deploy

The repo deploys to Vercel as a Next.js project.

- Add every variable from `.env.example` to the Vercel project.
- Don't set `PROVIDERS` in production.
- `vercel.json` schedules a daily cron (`/api/cron/keepalive`) that keeps a free Supabase project from pausing. It authenticates with `CRON_SECRET`.

## Layout

- `app/`: routes. `(workspace)` is the tester flow, `admin` the admin console, `api` the route handlers.
- `components/`: UI, grouped by screen.
- `lib/intake/`: reading a product page (price, rating, photos, brand kit, logo).
- `lib/round/`: planning, copy, backgrounds, compositing, checks and judging for a round.
- `lib/render/`: layout and drawing for a creative.
- `golden/`: replay test suites and their fixtures.
- `e2e/`: Playwright tests.
- `supabase/migrations/`: the database schema.
