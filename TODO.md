# TODO

## Product and Workflow

* [x] Move processed articles to a dedicated Raindrop collection. Successful runs now optionally move extracted source articles into a configured processed collection so they do not get picked up again from that configured source collection on the next run.
* [x] Add persisted latest-queue retrieval endpoints (e.g. `/queue/latest` and batch-specific HTML output). Latest stored queue JSON and batch HTML can now be served directly from Postgres without re-running extraction.
* [x] Tag-based filtering (e.g. only `tts`). `RAINDROP_SEARCH` and `?search=` now accept validated tag shorthand such as `tag:tts` or `tag:"long reads"`, and the Raindrop client normalizes that shorthand into the API's `#tag` filter syntax.
* [ ] Generate AI summaries per article (e.g. before each article `Summary: ...`). Keep summaries optional, bounded in length, and isolated from the core extraction flow so queue generation still works without the model step.
* [ ] Auto daily generation (cron). Define the schedule, destination of the generated output, and retry behavior when upstream extraction fails.
* [ ] Multi-language support. Decide whether this means language-aware extraction, different reading-speed defaults, translated UI text, or generated summaries in multiple languages.
* [x] Web UI (view + copy queue easily). An authenticated dashboard now lives at `/`, with login/signup controls, queue generation controls, stored-queue loading, batch preview/copy actions, skipped-article inspection, and recent run stats.
* [ ] One-tap iPhone Shortcut integration (one tap to fetch latest queue and open in ElevenReader). Specify the response format and shortcut flow so this works without manual HTML copy/paste.
* [ ] Deduplication + scoring. Prevent repeated articles across runs and define how freshness, length, source quality, tags, favorites, and source diversity affect queue priority.
* [ ] “Smart batching” (detect complexity, adjust pacing). Replace pure word-count batching with a configurable heuristic that considers article difficulty, density, source type, and language grouping.
* [ ] Direct ElevenReader integration (if API becomes available). Track API availability and design the integration so local HTML export remains a fallback path.
* [ ] Add dashboard presets and an advanced-controls drawer. Keep the common queue flow simple while still allowing per-run tuning for operator use.
* [x] Make run history actionable. The dashboard now supports loading a previous run, rerunning with the same config, comparing runs, and surfacing deeper failure/skip/move diagnostics.
* [ ] Improve onboarding and empty states. Turn missing configuration, missing stored queues, and first-run states into a guided setup flow with clear next actions.

## Deployment and Security

* [x] Add CI for typecheck, tests, and deployment-safe validation. GitHub Actions now runs `npm ci` and `npm run check` on every push and pull request in `.github/workflows/ci.yml`.
* [x] Protect the public API before exposing it on Vercel. The queue, run, and health endpoints now require an authenticated session created via `/api/session`, matching the authenticated web UI.
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

### Phase 1: Tenancy Foundation

* [x] Add first-class user/session tables and user-settings scaffolding. `users`, `user_sessions`, `user_settings`, and the related migrations now exist, and the legacy env credentials can bootstrap the first owner record.
* [x] Add tenant ownership to persisted run data. `queue_runs.user_id` now exists and recent-run/latest-run retrieval can scope on the authenticated user.
* [ ] Finish replacing the global single-user auth model with real user sessions. Login/signup now use database users and persisted sessions, but the legacy env-backed bootstrap/fallback path still exists.
* [x] Scope queue, run, and HTML-link lookups by user where persisted ownership exists. `/api/runs`, `/api/runs/:runId`, `/api/queue/latest`, `/api/queue/latest/html`, and signed batch-link minting now pass `session.userId`.
* [ ] Finish moving queue configuration out of environment variables and into per-user settings. `user_settings` exists and is seeded for the bootstrap user, but runtime generation still reads the Raindrop/config values from env vars.
* [ ] Add tenant-aware migrations for existing data. Define how the current single-user data maps into the first created user/admin account and make the migration reversible enough for development rollback.

### Phase 2: User Product Surface

* [ ] Finish redesigning the dashboard for account ownership. Basic signup/login/logout exists, but the settings area for connecting Raindrop, per-user collection selection, and true user-scoped configuration management are still missing.
* [ ] Add first-run onboarding for new users. Guide them through account creation, Raindrop connection, source collection setup, processed collection setup, and the first successful queue run.
* [ ] Add account recovery flows. Support password reset or magic-link email login so the app is usable without direct database or environment access.
* [ ] Add user-visible connection health and setup validation. Show when a Raindrop token is missing, invalid, expired, or misconfigured before the user tries to run extraction.
* [ ] Add per-user queue settings management. Let each user edit batching defaults, filters, reading-speed assumptions, and processed-collection behavior from the UI.
* [ ] Add user-scoped history and diagnostics views. Ensure comparison, rerun, skip diagnostics, and processed-move diagnostics only surface the current user's data.

### Phase 3: Production Hardening

* [ ] Add multi-tenant operational guardrails. Introduce per-user rate limits, quotas, concurrency caps, and isolated background processing so one user cannot starve the whole service.
* [ ] Encrypt or otherwise protect stored Raindrop credentials. Define how tokens are encrypted at rest, rotated, and masked in logs or admin tooling.
* [ ] Add audit logging for security-sensitive changes. Record account creation, login events, Raindrop credential updates, settings changes, and processed-move failures with user attribution.
* [ ] Add integration tests for tenant isolation. Verify that one user cannot read, rerun, compare, or fetch signed HTML for another user's runs or settings.
* [ ] Add production-ready session and security controls. Define password hashing, session invalidation, secure cookie policy, CSRF posture, and optional email verification requirements.
* [ ] Add observability with tenant context. Capture structured logs, job failures, request spikes, and auth errors with user/account identifiers that are safe for operations use.
* [ ] Add an admin/support surface. Decide whether you need a lightweight admin role for diagnosing user issues without granting direct database access.

### Phase 4: Durable Job Execution

* [ ] Make background processing explicitly tenant-aware. Ensure queued runs, scheduled jobs, and retry flows always run in the context of the correct user and Raindrop account.
* [ ] Add idempotent per-user job handling. Prevent duplicate queue generation, duplicate processed-item moves, and inconsistent retries when users refresh or retry aggressively.
* [ ] Add per-user scheduling. Let each user opt into automatic generation with their own cadence, source filters, and delivery preferences.
* [ ] Add queue ownership and retention policies. Decide how long user runs, HTML payloads, and diagnostics are retained and how deletion/export requests should behave.

### Phase 5: Operability And Trust

* [ ] Add user-facing account deletion/export flows. Define what happens to stored runs, signed links, and connected Raindrop credentials when a user leaves.
* [ ] Add disaster-recovery and rollback procedures for shared production. Document how to recover from bad migrations, auth outages, token corruption, or broken background jobs in a multi-user environment.
* [ ] Add staged rollout controls for major changes. Introduce feature flags or release gating so risky auth, settings, or queue-processing changes do not hit every user at once.
* [ ] Add support documentation and runbooks for a hosted shared app. Cover onboarding failures, token issues, queue failures, processed-move issues, and user-isolation incidents.
