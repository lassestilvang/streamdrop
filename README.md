# 🎧 Streamdrop

Streamdrop turns saved Raindrop links into listening-sized HTML queues for ElevenReader. It is written in TypeScript, designed for Vercel deployment, and does the heavy work server-side: fetch bookmarks, extract readable article text, batch by estimated reading time, and return ready-to-paste HTML.

The project pins Node.js to `24.x` so Vercel does not silently roll the app onto a newer major runtime.

## ✨ Why Streamdrop?

Most text-to-speech apps optimize for **reading one article at a time**.

Streamdrop flips that:

> Turn your reading backlog into a **podcast-like listening experience**

* ✅ Continuous playback (no manual switching)
* ✅ Works perfectly with ElevenReader
* ✅ No expensive TTS API costs
* ✅ Fully self-hosted (Vercel-friendly)
* ✅ Clean article extraction

## 🚀 How It Works

```
Raindrop → Fetch → Extract → Clean → Batch → HTML → ElevenReader
```

1. Fetch unread articles from Raindrop API
2. Extract clean content using Readability
3. Estimate reading time
4. Batch into ~30–60 min chunks
5. Generate a structured HTML document
6. Paste into ElevenReader → listen 🎧

## 📦 Features

* 📚 Fetch articles from Raindrop
* 🧹 Clean extraction (no ads, nav, clutter)
* ⏱️ Smart batching based on reading time
* 🎧 Optimized for TTS (clear separators, structure)
* ⚡ Serverless (deploy on Vercel)
* 💸 Zero ongoing cost (uses ElevenReader free tier)

## 📐 Architecture

The service is split into small modules under `api/_lib`:

- `config.js`: validates environment variables and request overrides.
- `raindrop.js`: paginated Raindrop API client.
- `extract.js`: bounded article fetch and Readability extraction with concurrency limits.
- `queue.js`: batching and HTML rendering.
- `persistence.js`: stores successful runs, batches, articles, and skips in Postgres.
- `service.js`: orchestration layer used by the API routes.

Database modules:

- `db/schema.ts`: Drizzle schema for persisted queue runs.
- `db/client.ts`: shared Postgres/Drizzle client for runtime and migrations.
- `drizzle/`: generated SQL migrations.

Routes:

- `index.html`: authenticated dashboard for queue control and inspection.
- `api/session.js`: single-user login/session management.
- `api/generate.js`: main queue-generation endpoint.
- `api/health.js`: health/configuration check for deployments.
- `api/queue/latest/index.js`: latest stored successful queue for a configuration.
- `api/queue/latest/html.js`: stored HTML for a latest queue batch.
- `api/runs/index.js`: list recent runs or create queued runs for async processing.
- `api/runs/[runId]/index.js`: inspect persisted run state.
- `api/runs/[runId]/process.js`: process a queued run.
- `api/runs/[runId]/html.js`: retrieve stored HTML for a specific run batch.

## 💻 Local development

Install dependencies:

```bash
npm install
```

Create `.env.local`:

```bash
cp .env.example .env.local
```

Local scripts load `.env.local` automatically.

Start the local server:

```bash
npm run dev
```

Available endpoints:

- `GET /`
- `GET /api/health`
- `GET /api/session`
- `POST /api/session`
- `DELETE /api/session`
- `GET /api/generate`
- `GET /api/queue/latest`
- `GET /api/queue/latest/html?batch=1`
- `GET /api/runs?limit=12`
- `POST /api/runs`
- `GET /api/runs/:runId`
- `POST /api/runs/:runId/process`
- `GET /api/runs/:runId/html?batch=1`

Run the test suite:

```bash
npm test
```

Run the TypeScript compiler:

```bash
npm run typecheck
```

Generate a migration after schema changes:

```bash
npm run db:generate
```

Apply migrations:

```bash
npm run db:migrate
```

## 🛠️ Configuration

Required:

- `DATABASE_URL`: Postgres connection string for persisted queue history.
- `RAINDROP_TOKEN`: Raindrop access token.

Optional:

- `APP_USERNAME`: single-user dashboard username. Default `streamdrop`.
- `APP_PASSWORD`: single-user dashboard password. Default `streamdrop`.
- `SESSION_SECRET`: cookie-signing secret for the web UI session.
- `RAINDROP_COLLECTION_ID`: collection to read from. Default `0` for all collections except trash.
- `RAINDROP_SEARCH`: Raindrop search filter.
- `MAX_MINUTES`: target duration per output batch. Default `45`.
- `WORDS_PER_MINUTE`: reading speed estimate. Default `180`.
- `MAX_ARTICLES`: max number of Raindrop items to attempt per request. Default `20`.
- `EXTRACTION_CONCURRENCY`: simultaneous article fetches. Default `4`.
- `FETCH_TIMEOUT_MS`: timeout for upstream calls. Default `12000`.
- `MAX_HTML_BYTES`: per-page HTML size cap before extraction. Default `750000`.

Request-level overrides are also supported via query string:

```text
/api/generate?maxArticles=10&maxMinutes=60&search=tag:tts
```

Supported query parameters:

- `collectionId`
- `search`
- `sort`
- `nested`
- `maxArticles`
- `maxMinutes`
- `wordsPerMinute`
- `concurrency`
- `timeoutMs`
- `maxHtmlBytes`

## 🖥️ Web UI

Open `/` to use the dashboard. It adds:

- Single-user authentication backed by a signed session cookie.
- Queue generation from the browser using the existing queued-run lifecycle.
- Stored latest-queue retrieval for the current configuration.
- Batch preview, copy-to-clipboard, and direct HTML opening.
- Skipped-article inspection.
- Recent run history and operator stats such as extraction rate, success streak, and skip pressure.

If you do not override the auth settings, the default login is:

- Username: `streamdrop`
- Password: `streamdrop`

## ☁️ Deployment on Vercel

1. Push the repository to GitHub.
2. Import it into Vercel as a project.
3. Add the required environment variables in Vercel:
   - `DATABASE_URL`
   - `RAINDROP_TOKEN`
   - Any optional variables you want to tune
4. Deploy.

GitHub Actions also needs a production database secret to run migrations on pushes to `main`:

- `PRODUCTION_DATABASE_URL`: production Neon/Vercel Postgres connection string used by `.github/workflows/migrate.yml`.

Vercel function settings are defined in `vercel.json`. The project currently requests:

- `maxDuration: 60`
- `memory: 1024`

Deployment smoke checks:

```bash
curl https://your-project.vercel.app/api/health
curl 'https://your-project.vercel.app/api/generate?maxArticles=5'
```

Schema changes:

- Commit generated Drizzle migrations under `drizzle/`.
- Push to `main` to run the production migration workflow.
- The migration workflow is separate from Vercel deploys, so there is still a small race window unless deploy promotion is gated outside Vercel.

## 💬 Response shape

`GET /api/generate` returns JSON with:

- `runId`
- `generatedAt`
- `config`
- `totals`
- `batches`
- `skipped`

Each batch includes metadata plus an `html` field that can be pasted directly into ElevenReader.

## 🔁 Stored runs and async flow

Synchronous generation:

- `GET /api/generate` generates a queue immediately, returns the JSON payload, and persists the run as `succeeded` or `failed`.

Retrieval:

- `GET /api/queue/latest` returns the latest successful stored run for the requested configuration.
- `GET /api/queue/latest/html?batch=1` returns stored HTML for a batch from that latest run.
- `GET /api/runs?limit=12` returns recent persisted run summaries for dashboard/history views.
- `GET /api/runs/:runId` returns the persisted lifecycle state for a specific run.
- `GET /api/runs/:runId/html?batch=1` returns stored HTML for a specific successful run.

Async lifecycle:

- `POST /api/runs` creates a persisted run in `queued` state.
- `POST /api/runs/:runId/process` processes that queued run and transitions it through `running` to `succeeded` or `failed`.

Current limitation:

- The async lifecycle is explicit but not yet self-driving. A caller still has to invoke the process endpoint; there is not yet a separate worker/cron path that drains queued runs automatically.

## 📝 Operational notes

- The service uses bounded upstream timeouts and per-document size caps to stay within Vercel’s request model.
- It escapes rendered HTML, so article titles and body text do not become executable markup in the output.
- Article-level extraction failures are reported in `skipped` instead of failing the whole queue.
- Whole-run failures are persisted to Postgres with status and structured error details.
- Successful runs are persisted to Postgres with per-batch, per-article, and skip metadata for later retrieval.
- `/api/health` reports whether configuration is valid without exposing secrets.
- Queue, run, and health endpoints require the single-user session gate exposed by `/api/session`.
