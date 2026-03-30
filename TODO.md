# TODO

## Product and Workflow

* [x] Move processed articles to a dedicated Raindrop collection. Successful runs now optionally move extracted source articles into a configured processed collection so they do not get picked up again on the next run.
* [x] Add persisted latest-queue retrieval endpoints (e.g. `/queue/latest` and batch-specific HTML output). Latest stored queue JSON and batch HTML can now be served directly from Postgres without re-running extraction.
* [ ] Tag-based filtering (e.g. only `tts`). Support either a default configured Raindrop search/tag filter or per-request filtering with validation.
* [ ] Generate AI summaries per article (e.g. before each article `Summary: ...`). Keep summaries optional, bounded in length, and isolated from the core extraction flow so queue generation still works without the model step.
* [ ] Auto daily generation (cron). Define the schedule, destination of the generated output, and retry behavior when upstream extraction fails.
* [ ] Multi-language support. Decide whether this means language-aware extraction, different reading-speed defaults, translated UI text, or generated summaries in multiple languages.
* [x] Web UI (view + copy queue easily). A single-user dashboard now lives at `/`, with signed-cookie auth, queue generation controls, stored-queue loading, batch preview/copy actions, skipped-article inspection, and recent run stats.
* [ ] One-tap iPhone Shortcut integration (one tap to fetch latest queue and open in ElevenReader). Specify the response format and shortcut flow so this works without manual HTML copy/paste.
* [ ] Deduplication + scoring. Prevent repeated articles across runs and define how freshness, length, source quality, tags, favorites, and source diversity affect queue priority.
* [ ] “Smart batching” (detect complexity, adjust pacing). Replace pure word-count batching with a configurable heuristic that considers article difficulty, density, source type, and language grouping.
* [ ] Direct ElevenReader integration (if API becomes available). Track API availability and design the integration so local HTML export remains a fallback path.
* [ ] Add dashboard presets and an advanced-controls drawer. Keep the common queue flow simple while still allowing per-run tuning for operator use.
* [ ] Make run history actionable. Support loading a previous run, rerunning with the same config, comparing results, and surfacing deeper failure/skip diagnostics.
* [ ] Improve onboarding and empty states. Turn missing configuration, missing stored queues, and first-run states into a guided setup flow with clear next actions.

## Deployment and Security

* [x] Add CI for typecheck, tests, and deployment-safe validation. GitHub Actions now runs `npm ci` and `npm run check` on every push and pull request in `.github/workflows/ci.yml`.
* [x] Protect the public API before exposing it on Vercel. The queue, run, and health endpoints now require a single-user session created via `/api/session`, matching the authenticated web UI.
* [ ] Add rate limiting and abuse controls. Prevent repeated expensive extraction requests from exhausting Vercel execution time or upstream bandwidth.
* [ ] Add request/response guardrails for production traffic. Define max request frequency, acceptable query overrides, and safe defaults for expensive knobs like `maxArticles` and `concurrency`.
* [ ] Tighten authentication defaults for production. Fail closed when `APP_USERNAME`, `APP_PASSWORD`, or `SESSION_SECRET` are missing instead of falling back to development-safe defaults.
* [ ] Harden public HTML link signing. Require a dedicated signing secret in production, shorten default TTLs, and document the intended exposure model for batch links.

## Reliability and Operations

* [x] Add persistent storage for generated queues and run history. Successful queue generations are now persisted in Postgres with run, batch, article, and skip records so previous outputs can be inspected and reused without re-fetching upstream content.
* [ ] Simplify the run execution model. Either move queued runs onto a real background worker/scheduled drain or collapse the current queue/process split into a single synchronous generate flow.
* [x] Define the async run lifecycle and API contract. Runs now persist `queued`, `running`, `succeeded`, and `failed` states with polling and retrieval endpoints, plus structured failure records for retry/debugging.
* [ ] Add observability and alerting. Capture structured logs, extraction failure rates, upstream timeout rates, and deployment/runtime errors.
* [x] Add a production-safe migration workflow. GitHub Actions now runs `npm run db:migrate` on pushes to `main` using the `PRODUCTION_DATABASE_URL` secret.
* [ ] Add deployment smoke checks and runbooks. Document what to verify after each Vercel deploy and what to do when Raindrop auth, extraction, or quota failures start happening.
* [ ] Add integration tests that cover real route behavior with mocked upstreams. Verify error mapping, timeout handling, skipped-article behavior, and HTML rendering from the API surface, not just helpers.

## Multi-user Expansion

* [ ] Add first-class user and account tables. Create `users` plus per-user Raindrop account/settings records, then attach `user_id` to runs and related artifacts so all persisted data becomes tenant-aware.
* [ ] Replace the global single-user auth model with real user sessions. Move from deployment-level credentials to user records, store user identity in the session, and reject cross-user access on every route.
* [ ] Scope all queue, run, and HTML-link queries by user. Ensure `/api/runs`, `/api/runs/:runId`, `/api/queue/latest`, and signed batch links only operate on the current user's records.
* [ ] Move queue configuration out of environment variables and into per-user settings. Persist each user's Raindrop token, source collection, processed collection, filters, and batching defaults.
* [ ] Redesign the dashboard for account ownership. Add signup/login/logout flows, a settings area for connecting Raindrop, per-user collection selection, and user-scoped queue history.
* [ ] Add multi-tenant operational guardrails. Introduce per-user rate limits, quotas, concurrency caps, isolated background processing, and audit logging for account/configuration changes.
