# TODO

## Product and Workflow

* [ ] Mark processed articles as read in Raindrop. Define when an item becomes "processed" and make the update idempotent so retries do not corrupt state.
* [x] Add persisted latest-queue retrieval endpoints (e.g. `/queue/latest` and batch-specific HTML output). Latest stored queue JSON and batch HTML can now be served directly from Postgres without re-running extraction.
* [ ] Tag-based filtering (e.g. only `tts`). Support either a default configured Raindrop search/tag filter or per-request filtering with validation.
* [ ] Generate AI summaries per article (e.g. before each article `Summary: ...`). Keep summaries optional, bounded in length, and isolated from the core extraction flow so queue generation still works without the model step.
* [ ] Auto daily generation (cron). Define the schedule, destination of the generated output, and retry behavior when upstream extraction fails.
* [ ] Multi-language support. Decide whether this means language-aware extraction, different reading-speed defaults, translated UI text, or generated summaries in multiple languages.
* [x] Web UI (view + copy queue easily). A single-user dashboard now lives at `/`, with signed-cookie auth, queue generation controls, stored-queue loading, batch preview/copy actions, skipped-article inspection, and recent run stats.
* [ ] One-tap iPhone Shortcut integration (one tap to fetch latest queue and open in ElevenReader). Specify the response format and shortcut flow so this works without manual HTML copy/paste.
* [ ] Deduplication + scoring. Prevent repeated articles across runs and define how freshness, length, source quality, tags, or favorites affect queue priority.
* [ ] “Smart batching” (detect complexity, adjust pacing). Replace pure word-count batching with a configurable heuristic that considers article difficulty, density, or source type.
* [ ] Direct ElevenReader integration (if API becomes available). Track API availability and design the integration so local HTML export remains a fallback path.

## Deployment and Security

* [x] Add CI for typecheck, tests, and deployment-safe validation. GitHub Actions now runs `npm ci` and `npm run check` on every push and pull request in `.github/workflows/ci.yml`.
* [x] Protect the public API before exposing it on Vercel. The queue, run, and health endpoints now require a single-user session created via `/api/session`, matching the authenticated web UI.
* [ ] Add rate limiting and abuse controls. Prevent repeated expensive extraction requests from exhausting Vercel execution time or upstream bandwidth.
* [ ] Add request/response guardrails for production traffic. Define max request frequency, acceptable query overrides, and safe defaults for expensive knobs like `maxArticles` and `concurrency`.

## Reliability and Operations

* [x] Add persistent storage for generated queues and run history. Successful queue generations are now persisted in Postgres with run, batch, article, and skip records so previous outputs can be inspected and reused without re-fetching upstream content.
* [ ] Add automatic background generation for larger queues. The run lifecycle and queue/process endpoints now exist, but queued runs still need an explicit processor call instead of a dedicated worker or scheduled drain.
* [x] Define the async run lifecycle and API contract. Runs now persist `queued`, `running`, `succeeded`, and `failed` states with polling and retrieval endpoints, plus structured failure records for retry/debugging.
* [ ] Add observability and alerting. Capture structured logs, extraction failure rates, upstream timeout rates, and deployment/runtime errors.
* [x] Add a production-safe migration workflow. GitHub Actions now runs `npm run db:migrate` on pushes to `main` using the `PRODUCTION_DATABASE_URL` secret.
* [ ] Add deployment smoke checks and runbooks. Document what to verify after each Vercel deploy and what to do when Raindrop auth, extraction, or quota failures start happening.
* [ ] Add integration tests that cover real route behavior with mocked upstreams. Verify error mapping, timeout handling, skipped-article behavior, and HTML rendering from the API surface, not just helpers.
