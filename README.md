# Streamdrop

Streamdrop turns saved Raindrop links into listening-sized HTML queues for ElevenReader. It is written in TypeScript, designed for Vercel deployment, and does the heavy work server-side: fetch bookmarks, extract readable article text, batch by estimated reading time, and return ready-to-paste HTML.

## Architecture

The service is split into small modules under `api/_lib`:

- `config.js`: validates environment variables and request overrides.
- `raindrop.js`: paginated Raindrop API client.
- `extract.js`: bounded article fetch and Readability extraction with concurrency limits.
- `queue.js`: batching and HTML rendering.
- `service.js`: orchestration layer used by the API routes.

Routes:

- `api/generate.js`: main queue-generation endpoint.
- `api/health.js`: health/configuration check for deployments.

## Local development

Install dependencies:

```bash
npm install
```

Create `.env.local` or export variables in your shell:

```bash
cp .env.example .env.local
export $(grep -v '^#' .env.local | xargs)
```

Start the local server:

```bash
npm run dev
```

Available endpoints:

- `GET /api/health`
- `GET /api/generate`

Run the test suite:

```bash
npm test
```

Run the TypeScript compiler:

```bash
npm run typecheck
```

## Configuration

Required:

- `RAINDROP_TOKEN`: Raindrop access token.

Optional:

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

## Deployment on Vercel

1. Push the repository to GitHub.
2. Import it into Vercel as a project.
3. Add the required environment variables in Vercel:
   - `RAINDROP_TOKEN`
   - Any optional variables you want to tune
4. Deploy.

Vercel function settings are defined in `vercel.json`. The project currently requests:

- `maxDuration: 60`
- `memory: 1024`

Deployment smoke checks:

```bash
curl https://your-project.vercel.app/api/health
curl 'https://your-project.vercel.app/api/generate?maxArticles=5'
```

## Response shape

`GET /api/generate` returns JSON with:

- `generatedAt`
- `config`
- `totals`
- `batches`
- `skipped`

Each batch includes metadata plus an `html` field that can be pasted directly into ElevenReader.

## Operational notes

- The service uses bounded upstream timeouts and per-document size caps to stay within Vercel’s request model.
- It escapes rendered HTML, so article titles and body text do not become executable markup in the output.
- Extraction failures are reported in `skipped` instead of failing the whole queue.
- `/api/health` reports whether configuration is valid without exposing secrets.
